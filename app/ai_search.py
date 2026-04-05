import os
import json
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
 "min_price": null,
 "max_price": null
}}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You extract shopping search parameters."},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )

    text = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(text)
    except:
        parsed = {
            "search_query": user_query,
            "product_type": "",
            "min_price": None,
            "max_price": None
        }

    print("OpenAI received query:", user_query)
    print("OpenAI parsed result:", parsed)

    return parsed