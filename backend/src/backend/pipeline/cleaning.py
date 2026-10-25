import pandas as pd

from backend.core.config import settings

#drop duplicate rows on a dataframe based on certain columns
def drop_duplicates(df : pd.DataFrame, *columns : str) -> pd.DataFrame:
    df_no_duplicates = df.drop_duplicates(subset=columns or None, keep="last")
    return df_no_duplicates

#replace the mis-encoded "ú" with a pound sign in every text column
def fix_encoding(df : pd.DataFrame) -> pd.DataFrame:
    df_fixed = df.copy()
    text_columns = df_fixed.select_dtypes(include="str").columns
    df_fixed[text_columns] = df_fixed[text_columns].replace("ú", "£", regex=True)
    return df_fixed

#strip leading and trailing whitespace from every text column
def strip_whitespace(df : pd.DataFrame) -> pd.DataFrame:
    df_stripped = df.copy()
    text_columns = df_stripped.select_dtypes(include="str").columns
    df_stripped[text_columns] = df_stripped[text_columns].apply(lambda column: column.str.strip())
    return df_stripped

#drop rows where a numeric column falls outside [minimum, maximum]
def check_ranges(df : pd.DataFrame, column : str, minimum : float, maximum : float) -> pd.DataFrame:
    df_in_range = df[df[column].between(minimum, maximum)]
    return df_in_range

#drop rows where actual_age doesn't fall inside the age band, e.g. "25-34" or "65+"
def check_age_matches_band(df : pd.DataFrame) -> pd.DataFrame:
    band_bounds = df["age"].str.extract(r"(\d+)(?:-(\d+))?").astype(float)
    lower = band_bounds[0]
    upper = band_bounds[1].fillna(float("inf"))
    df_matching = df[df["actual_age"].between(lower, upper)]
    return df_matching

#convert columns that only contain "Yes"/"No" into nullable booleans
def convert_yes_no_to_bool(df : pd.DataFrame) -> pd.DataFrame:
    df_converted = df.copy()
    for column in df_converted.select_dtypes(include="str").columns:
        values = set(df_converted[column].dropna().unique())
        if values and values <= {"Yes", "No"}:
            df_converted[column] = df_converted[column].map({"Yes": True, "No": False}).astype("boolean")
    return df_converted

#fill missing answers in text columns with a placeholder
def fill_missing(df : pd.DataFrame, placeholder : str = "Not answered") -> pd.DataFrame:
    df_filled = df.copy()
    text_columns = df_filled.select_dtypes(include="str").columns
    df_filled[text_columns] = df_filled[text_columns].fillna(placeholder)
    return df_filled

#return the rows in before that are missing from after, tagged with why they were removed
def get_removed_rows(before : pd.DataFrame, after : pd.DataFrame, reason : str) -> pd.DataFrame:
    removed_rows = before.loc[before.index.difference(after.index)]
    return removed_rows.assign(removal_reason=reason)

#run every cleaning step in order, returning the clean data and the rows each filter removed
def clean_data(df : pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    removed = []

    df_clean = drop_duplicates(df, "serial_number")
    removed.append(get_removed_rows(df, df_clean, "duplicate serial_number"))

    df_clean = fix_encoding(df_clean)
    df_clean = strip_whitespace(df_clean)

    df_in_range = check_ranges(df_clean, "actual_age", 18, 120)
    removed.append(get_removed_rows(df_clean, df_in_range, "actual_age out of range"))
    df_clean = df_in_range

    df_matching = check_age_matches_band(df_clean)
    removed.append(get_removed_rows(df_clean, df_matching, "actual_age outside age band"))
    df_clean = df_matching

    df_removed = pd.concat(removed)
    return df_clean, df_removed

#convert cleaned data into analysis-friendly types, for use in pandas rather than the database
def format_for_analysis(df : pd.DataFrame) -> pd.DataFrame:
    df_formatted = convert_yes_no_to_bool(df)
    df_formatted = fill_missing(df_formatted)
    return df_formatted

#print the row count for each distinct value of every column
def print_grouped_by_columns(df : pd.DataFrame) -> None:
    for column in df.columns:
        print(f"--- {column} ---")
        print(df.groupby(column, dropna=False).size().to_string())
        print()

if __name__ == "__main__":
    print(settings.source_data_path)
    df = pd.read_csv(settings.source_data_path)
    #print(df["serial_number"].duplicated().sum())
    dupes = df[df.duplicated(keep=False)]
    #print(dupes.size)
    #dupes.to_csv('dupes.csv', encoding='utf-8')
    df_clean, df_removed = clean_data(df)
    print_grouped_by_columns(format_for_analysis(df_clean))
    print("--- removed rows ---")
    print(df_removed.groupby("removal_reason").size().to_string())
    #print(drop_duplicates(df, "serial_number"))
