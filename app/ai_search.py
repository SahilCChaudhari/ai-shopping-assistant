import os
import json
import base64
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def parse_query(user_query):
    prompt = f"""
Extract shopping search filters from this query.

Important rules:
- Only fill brand, gender, product_type, and source if the user clearly mentions them.
- For broad queries like "shoes" or "best shoes under 50", keep product_type simple or leave it empty.
- Do not guess extra filters.
- Return ONLY valid JSON.

Query:
{user_query}

Format:
{{
  "search_query": "",
  "brand": "",
  "gender": "",
  "product_type": "",
  "source": "",
  "min_price": null,
  "max_price": null
}}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You extract shopping filters from user queries and return only JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    text = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = {
            "search_query": user_query,
            "brand": "",
            "gender": "",
            "product_type": "",
            "source": "",
            "min_price": None,
            "max_price": None
        }

    print("OpenAI received query:", user_query)
    print("OpenAI parsed result:", parsed)

    return parsed


def parse_product_image(image_bytes, mime_type="image/jpeg"):
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """
Analyze this image and identify the product for shopping search.

Return ONLY valid JSON.

Rules:
- Identify the likely product shown in the image.
- Keep the search query practical for shopping search.
- Do not over-specify uncertain details.
- If brand is unclear, leave it empty.
- If gender is unclear, leave it empty.

Format:
{
  "search_query": "",
  "brand": "",
  "gender": "",
  "product_type": "",
  "color": "",
  "style": "",
  "material": ""
}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You analyze product images and return shopping-friendly JSON only."
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{encoded_image}"
                        }
                    }
                ]
            }
        ],
        temperature=0
    )

    text = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = {
            "search_query": "",
            "brand": "",
            "gender": "",
            "product_type": "",
            "color": "",
            "style": "",
            "material": ""
        }

    print("OpenAI parsed image result:", parsed)
    return parsed


def compare_with_ai(products):
    prompt = f"""
Compare these products and recommend the best overall option.

For each product, consider:
- price
- likely quality/value
- brand/store trust
- relevance to the product type
- what kind of buyer it suits best

Then provide:
1. a short comparison
2. the best overall pick
3. the best budget pick

Keep it concise.
Return plain text only.

Products:
{json.dumps(products, indent=2)}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You compare shopping products and give practical recommendations."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3
    )

    return response.choices[0].message.content.strip()