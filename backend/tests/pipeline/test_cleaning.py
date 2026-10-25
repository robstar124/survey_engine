import pandas as pd
import pytest

from backend.pipeline.cleaning import (
    check_age_matches_band,
    check_ranges,
    clean_data,
    convert_yes_no_to_bool,
    drop_duplicates,
    fill_missing,
    fix_encoding,
    format_for_analysis,
    get_removed_rows,
    strip_whitespace,
)


#drop_duplicates
#when serial numbers repeat, the last row is kept, so later corrections in the file win
def test_drop_duplicates_keeps_last_row_per_column_value():
    df = pd.DataFrame({"serial_number": [1, 1, 2], "gender": ["Male", "Female", "Male"]})
    result = drop_duplicates(df, "serial_number")
    assert result["serial_number"].tolist() == [1, 2]
    assert result["gender"].tolist() == ["Female", "Male"]

#with no columns given, only rows identical in every column count as duplicates
def test_drop_duplicates_without_columns_compares_whole_rows():
    df = pd.DataFrame({"serial_number": [1, 1, 1], "gender": ["Male", "Male", "Female"]})
    result = drop_duplicates(df)
    assert len(result) == 2


#fix_encoding
#every "ú" becomes "£", including several in one value, and text without one is unchanged
def test_fix_encoding_replaces_every_mis_encoded_character():
    df = pd.DataFrame({"income": ["ú14,001 to ú21,000", "Up to ú7,000", "Prefer not to answer"]})
    result = fix_encoding(df)
    assert result["income"].tolist() == ["£14,001 to £21,000", "Up to £7,000", "Prefer not to answer"]

#numeric columns are skipped and the original dataframe isn't modified
def test_fix_encoding_leaves_numeric_columns_and_input_untouched():
    df = pd.DataFrame({"income": ["ú7,000"], "actual_age": [30]})
    result = fix_encoding(df)
    assert result["actual_age"].tolist() == [30]
    assert df["income"].tolist() == ["ú7,000"]


#strip_whitespace
#leading and trailing spaces are removed so " Male" and "Male" group together
def test_strip_whitespace_trims_both_ends():
    df = pd.DataFrame({"gender": ["  Male", "Female  ", " Prefer not to say "]})
    result = strip_whitespace(df)
    assert result["gender"].tolist() == ["Male", "Female", "Prefer not to say"]

#missing values stay missing instead of becoming the string "nan" or ""
def test_strip_whitespace_keeps_missing_values():
    df = pd.DataFrame({"gender": [" Male", None]})
    result = strip_whitespace(df)
    assert result["gender"].iloc[0] == "Male"
    assert pd.isna(result["gender"].iloc[1])


#check_ranges
#the range is inclusive: 18 and 120 are kept, 17 and 121 are dropped
def test_check_ranges_keeps_bounds_and_drops_outside_values():
    df = pd.DataFrame({"actual_age": [17, 18, 50, 120, 121]})
    result = check_ranges(df, "actual_age", 18, 120)
    assert result["actual_age"].tolist() == [18, 50, 120]


#check_age_matches_band
#ages inside their band are kept, including both ends of a band and open-ended bands like 65+
@pytest.mark.parametrize("band, age", [("18-24", 18), ("18-24", 24), ("25-34", 30), ("65+", 65), ("65+", 93)])
def test_check_age_matches_band_keeps_matching_rows(band, age):
    df = pd.DataFrame({"age": [band], "actual_age": [age]})
    assert len(check_age_matches_band(df)) == 1

#ages just outside their band, or in a different band entirely, are dropped
@pytest.mark.parametrize("band, age", [("18-24", 17), ("18-24", 25), ("35-44", 50), ("65+", 64)])
def test_check_age_matches_band_drops_mismatched_rows(band, age):
    df = pd.DataFrame({"age": [band], "actual_age": [age]})
    assert len(check_age_matches_band(df)) == 0


#convert_yes_no_to_bool
#columns holding only Yes/No become nullable booleans, keeping blanks as missing rather than False
def test_convert_yes_no_to_bool_converts_yes_no_columns():
    df = pd.DataFrame({"owns_property": ["Yes", "No", None]})
    result = convert_yes_no_to_bool(df)
    assert result["owns_property"].dtype == "boolean"
    assert result["owns_property"].iloc[0] == True
    assert result["owns_property"].iloc[1] == False
    assert pd.isna(result["owns_property"].iloc[2])

#columns with any other answers (or only blanks) are left as text, so a "Yes"/"Don't know" question isn't half converted
def test_convert_yes_no_to_bool_ignores_other_text_columns():
    df = pd.DataFrame({"vote": ["Leave", "Remain"], "answer": ["Yes", "Don't know"], "blank": [None, None]})
    result = convert_yes_no_to_bool(df)
    assert result["vote"].tolist() == ["Leave", "Remain"]
    assert result["answer"].tolist() == ["Yes", "Don't know"]
    assert result["blank"].dtype != "boolean"


#fill_missing
#blank text answers become "Not answered" so they show up as their own group in analysis
def test_fill_missing_uses_default_placeholder():
    df = pd.DataFrame({"do_you_work_in": ["Other", None]})
    result = fill_missing(df)
    assert result["do_you_work_in"].tolist() == ["Other", "Not answered"]

#a custom placeholder can be used, and boolean columns keep their blanks as missing rather than getting text
def test_fill_missing_uses_custom_placeholder_and_skips_bool_columns():
    df = pd.DataFrame({"vote": [None, "Leave"], "owns_property": pd.array([True, None], dtype="boolean")})
    result = fill_missing(df, placeholder="Did not vote")
    assert result["vote"].tolist() == ["Did not vote", "Leave"]
    assert pd.isna(result["owns_property"].iloc[1])


#clean_data
#the full pipeline dedupes, fixes encoding, trims spaces and drops age mismatches, but leaves Yes/No as text for the database, and records why each row was removed
def test_clean_data_runs_every_step():
    df = pd.DataFrame({
        "serial_number": [1, 1, 2, 3, 4],
        "age": ["18-24", "18-24", "65+", "25-34", "25-34"],
        "actual_age": [20, 20, 70, 40, 30],
        "income": [" ú7,000", " ú7,000", None, "ú7,000", "ú7,000"],
        "owns_property": ["Yes", "Yes", "No", "No", None],
    })
    result, removed = clean_data(df)
    assert result["serial_number"].tolist() == [1, 2, 4]
    assert result["income"].tolist()[0] == "£7,000"
    assert pd.isna(result["income"].iloc[1])
    assert result["owns_property"].tolist()[:2] == ["Yes", "No"]
    assert removed["serial_number"].tolist() == [1, 3]
    assert removed["removal_reason"].tolist() == ["duplicate serial_number", "actual_age outside age band"]

#clean data passes through unchanged with an empty removal log
def test_clean_data_removed_rows_are_empty_when_nothing_is_dropped():
    df = pd.DataFrame({"serial_number": [1], "age": ["65+"], "actual_age": [70]})
    result, removed = clean_data(df)
    assert len(result) == 1
    assert removed.empty


#format_for_analysis
#the analysis step applies both the boolean conversion and the missing-answer placeholder
def test_format_for_analysis_converts_yes_no_and_fills_missing():
    df = pd.DataFrame({"owns_property": ["Yes", None], "income": [None, "£7,000"]})
    result = format_for_analysis(df)
    assert result["owns_property"].dtype == "boolean"
    assert result["income"].tolist() == ["Not answered", "£7,000"]


#get_removed_rows
#only rows missing from the filtered frame are returned, tagged with the reason they were dropped
def test_get_removed_rows_returns_only_dropped_rows_with_reason():
    before = pd.DataFrame({"serial_number": [1, 2, 3]})
    after = before.iloc[[0, 2]]
    removed = get_removed_rows(before, after, "test reason")
    assert removed["serial_number"].tolist() == [2]
    assert removed["removal_reason"].tolist() == ["test reason"]
