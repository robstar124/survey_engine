#question codes and helpers shared by the api tests
STATEMENT = "which_of_the_following_statements_apply_to_you_i_own_more_than_one_property"
ATTITUDE = "general_attitudes_i_consider_myself_working_class"

#look up a question's id by its csv column name
def question_id(client, code : str) -> int:
    return next(question["id"] for question in client.get("/questions").json() if question["code"] == code)
