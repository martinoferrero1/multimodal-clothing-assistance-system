def normalize_text(text: str) -> str:
    try:
        return text.encode().decode("unicode_escape")
    except:
        return text