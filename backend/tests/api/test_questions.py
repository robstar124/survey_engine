from tests.api.helpers import ATTITUDE, STATEMENT, question_id


#questions
#every loaded question comes back, in the order they were inserted (csv column order)
def test_list_questions_returns_every_question(client):
    response = client.get("/questions")
    assert response.status_code == 200
    assert [question["code"] for question in response.json()] == [STATEMENT, ATTITUDE]

#?category= narrows the list to one category, and question text is the readable version of the column name
def test_list_questions_filters_by_category(client):
    response = client.get("/questions", params={"category": "general_attitudes"})
    assert [question["text"] for question in response.json()] == ["I consider myself working class"]

#each category is listed once, alphabetically, for building the sidebar sections
def test_list_categories(client):
    assert client.get("/questions/categories").json() == ["general_attitudes", "statements"]

#a single question can be fetched by its database id
def test_get_question(client):
    attitude_id = question_id(client, ATTITUDE)
    response = client.get(f"/questions/{attitude_id}")
    assert response.status_code == 200
    assert response.json()["category"] == "general_attitudes"

#an unknown id is a 404, not a 500 or an empty body
def test_get_question_returns_404_when_missing(client):
    assert client.get("/questions/999").status_code == 404


#question results
#results count each answer value, sort the most common first, and leave groups empty without group_by
def test_question_results_counts_answers_most_common_first(client):
    response = client.get(f"/questions/{question_id(client, ATTITUDE)}/results")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["counts"] == [{"value": "Agree strongly", "count": 2}, {"value": "Don't know", "count": 1}]
    assert body["groups"] is None

#respondents who left a question blank are left out of its base, rather than counted as an answer
def test_question_results_skip_unanswered(client):
    body = client.get(f"/questions/{question_id(client, STATEMENT)}/results").json()
    assert body["total"] == 2

#demographic and age filters are combined, so only respondents matching all of them are counted
def test_question_results_apply_filters(client):
    attitude_id = question_id(client, ATTITUDE)
    body = client.get(f"/questions/{attitude_id}/results", params={"gender": "Female", "max_age": 40}).json()
    assert body["counts"] == [{"value": "Agree strongly", "count": 1}]

#repeating a filter (?region=a&region=b) matches respondents with any of those values
def test_question_results_filter_matches_any_repeated_value(client):
    attitude_id = question_id(client, ATTITUDE)
    body = client.get(f"/questions/{attitude_id}/results", params={"region": ["London", "West Midlands"]}).json()
    assert body["total"] == 2

#group_by splits the counts into one group per demographic value, each with its own base
def test_question_results_group_by_demographic(client):
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params={"group_by": "gender"}).json()
    assert body["group_by"] == "gender"
    assert body["groups"] == [
        {"group": "Female", "total": 2, "counts": [{"value": "Agree strongly", "count": 1}, {"value": "Don't know", "count": 1}]},
        {"group": "Male", "total": 1, "counts": [{"value": "Agree strongly", "count": 1}]},
    ]

#respondents with no value for the grouping field (work_sector is only asked of public sector workers) form their own group, placed last
def test_question_results_group_by_puts_missing_values_last(client):
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params={"group_by": "work_sector"}).json()
    assert [group["group"] for group in body["groups"]] == ["Other", None]

#group_by_question splits the counts by each respondent's answer to another question; people who skipped it form a None group, placed last
def test_question_results_group_by_question(client):
    params = {"group_by_question": question_id(client, STATEMENT)}
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).json()
    assert body["group_by"] is None
    assert body["group_by_question"] == params["group_by_question"]
    assert body["groups"] == [
        {"group": "No", "total": 1, "counts": [{"value": "Agree strongly", "count": 1}]},
        {"group": "Yes", "total": 1, "counts": [{"value": "Agree strongly", "count": 1}]},
        {"group": None, "total": 1, "counts": [{"value": "Don't know", "count": 1}]},
    ]

#filters still apply when grouping by another question
def test_question_results_group_by_question_applies_filters(client):
    params = {"group_by_question": question_id(client, STATEMENT), "gender": "Female"}
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).json()
    assert [(group["group"], group["total"]) for group in body["groups"]] == [("Yes", 1), (None, 1)]

#the table can only have one breakdown, so asking for both is a 422
def test_question_results_reject_two_breakdowns(client):
    params = {"group_by": "gender", "group_by_question": question_id(client, STATEMENT)}
    assert client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).status_code == 422

#breaking down by a question that doesn't exist is a 404, like asking for its results
def test_question_results_group_by_unknown_question_returns_404(client):
    params = {"group_by_question": 999}
    assert client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).status_code == 404

#answer filters keep only respondents who gave that answer to another question
def test_question_results_filter_by_answer(client):
    params = {"answer": f"{question_id(client, STATEMENT)}:Yes"}
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).json()
    assert body["total"] == 1
    assert body["counts"] == [{"value": "Agree strongly", "count": 1}]

#several answers to one question match any of them, so skipping the question is the only way to be left out
def test_question_results_answer_filter_matches_any_value_for_a_question(client):
    statement_id = question_id(client, STATEMENT)
    params = {"answer": [f"{statement_id}:Yes", f"{statement_id}:No"]}
    body = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params=params).json()
    assert body["total"] == 2

#answer filters on different questions must all match, and combine with demographic filters
def test_question_results_answer_filters_on_different_questions_all_apply(client):
    attitude_id, statement_id = question_id(client, ATTITUDE), question_id(client, STATEMENT)
    params = {"answer": [f"{attitude_id}:Agree strongly", f"{statement_id}:No"]}
    assert client.get(f"/questions/{statement_id}/results", params=params).json()["counts"] == [{"value": "No", "count": 1}]
    params = {"answer": f"{attitude_id}:Agree strongly", "gender": "Female"}
    assert client.get(f"/questions/{statement_id}/results", params=params).json()["counts"] == [{"value": "Yes", "count": 1}]

#an answer filter that isn't <question id>:<value> is a 422 rather than being ignored
def test_question_results_reject_malformed_answer_filter(client):
    attitude_id = question_id(client, ATTITUDE)
    for answer in ["Yes", f"{attitude_id}", f"{attitude_id}:", "abc:Yes"]:
        response = client.get(f"/questions/{attitude_id}/results", params={"answer": answer})
        assert response.status_code == 422, answer

#group_by only accepts demographic fields, so arbitrary columns like serial_number can't be grouped on
def test_question_results_reject_unknown_group_by(client):
    response = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params={"group_by": "serial_number"})
    assert response.status_code == 422

#unknown query parameters are a 422 instead of being silently ignored, so a typo in a filter can't return unfiltered results
def test_question_results_reject_unknown_filters(client):
    response = client.get(f"/questions/{question_id(client, ATTITUDE)}/results", params={"colour": "blue"})
    assert response.status_code == 422

#results for an unknown question are a 404 rather than empty counts
def test_question_results_returns_404_when_missing(client):
    assert client.get("/questions/999/results").status_code == 404
