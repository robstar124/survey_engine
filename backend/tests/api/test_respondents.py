from tests.api.helpers import ATTITUDE, question_id


#respondents
#limit and offset return one page, ordered by serial number, while total still counts every match
def test_list_respondents_pages_results(client):
    body = client.get("/respondents", params={"limit": 2, "offset": 1}).json()
    assert body["total"] == 3
    assert [respondent["serial_number"] for respondent in body["items"]] == [14, 15]

#the same filters as the results endpoint work here, with age_band exposed under its api name
def test_list_respondents_applies_filters(client):
    body = client.get("/respondents", params={"gender": "Female", "min_age": 60}).json()
    assert body["total"] == 1
    assert body["items"][0]["serial_number"] == 14
    assert body["items"][0]["age_band"] == "55-64"

#answer filters work here too, so the frontend's matching count agrees with the filtered results
def test_list_respondents_applies_answer_filters(client):
    body = client.get("/respondents", params={"answer": f"{question_id(client, ATTITUDE)}:Don't know"}).json()
    assert body["total"] == 1
    assert body["items"][0]["serial_number"] == 14

#a limit below 1 is rejected rather than returning nothing
def test_list_respondents_rejects_bad_limit(client):
    assert client.get("/respondents", params={"limit": 0}).status_code == 422

#each demographic field lists its distinct values once, sorted, without null, for building filter options
def test_list_demographics_returns_distinct_values_without_missing(client):
    body = client.get("/respondents/demographics").json()
    assert body["gender"] == ["Female", "Male"]
    assert body["work_sector"] == ["Other"]
