import os
import json
import anthropic

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

def parse_query(user_query):

    prompt = f"""
You are a shopping assistant.

Extract product search information from the user query.

Return JSON only.

Query:
{user_query}

Format:
{{
 "search_query": "",
 "product_type": "",
 "max_price": null
}}
"""

    message = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=200,
        temperature=0,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    text = message.content[0].text

    return json.loads(text)