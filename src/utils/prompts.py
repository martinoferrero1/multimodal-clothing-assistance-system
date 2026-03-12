from typing import Optional
    
def get_prompt_from_path(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as file:
        prompt = file.read()
    return prompt

def build_prompt(base_prompt_path: str, examples_prompt_path: Optional[str], include_examples: bool) -> str:
    base_prompt = get_prompt_from_path(base_prompt_path)
    if include_examples and examples_prompt_path:
        examples_prompt = get_prompt_from_path(examples_prompt_path)
        return f"{base_prompt}\n{examples_prompt}"
    return base_prompt