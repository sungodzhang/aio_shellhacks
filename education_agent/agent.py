import datetime
from zoneinfo import ZoneInfo
from google.adk.agents import Agent
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
import json
import ast

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)


def addition(question: str) -> dict | str:
    """Constructs a representation of a math problem that requires a user to add objects.

    Args:
        question: The math problem that needs to be represented and solved.

    Returns:
        dict: method, scenario, assets.
        str: method, scenario, assets.
    """

    example = {
        "method": "addition",
        "scenario": "Youre packing a picnic basket! You have some apples and then pick some more. Drag the apples to the basket to show the total.",
        "solution": "The problem asks to find the total number of apples after combining two groups. This is a simple addition problem: 1 apple + 2 apples = 3 apples. So, one apple should go to Basket and two apples should go to Basket, totalling 3 apples in Basket.",
        "assets": {
            "origins": ['1 Apple', '2 Apples'],
            "target": "Basket"
        }
    }

    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"You are a helpful agent who can construct an interactive problem from the following math question: {question}. You must create a realistic scenario that mathematically represents the math question. The representation should be in the form of images the user must drag to a single target. To complete the scenario, the user must correctly drag the objects in a way that represents the equation. For example, if I ask 1 + 2, the result will be {example}\n"
        "INPUT: a single math question string.\n"
        "OUTPUT: STRICT JSON matching the schema below. Do not include any text outside JSON.\n"
        "SCHEMA:\n"
        "{\n"
        '  "method": "addition"\n'
        '  "scenario": string,                 // ≤ 60 words, real-world context only\n'
        '  "solution": string,                 // explain how the user could use math to solve the problem\n'
        '  "assets": {\n'
        '    "origins": string[],              // labels or short captions shown on draggable images (2-6 items)\n'
        '    "target": string                  // labels or short captions shown on the target image\n'
        "  }\n"
        "}\n"
        "CONSTRAINTS:\n"
        "- 2-6 origins only.\n"
        "- Use short, concrete nouns/phrases (≤4 words each) for origins/target.\n"
        "- The origin assets should always be an integer followed by the object"
        "- No equations or explanations in the JSON; the scenario carries the story.\n"
        "- If the question is ambiguous, choose a reasonable, common K-12 interpretation.\n"
        "VALIDATION:\n"
        "Return dictionary only. If you're needs to be written, always write youre instead of you're or you\"re",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0) # Disables thinking
        )
    )
    
    return response.text


def deletion(question: str) -> dict | str:
    """Constructs a representation of a math problem that requires a user to delete.

    Args:
        question: The math problem that needs to be represented and solved.

    Returns:
        dict: method, scenario, assets, mapping.
        str: method, scenario, assets, mapping.
    """

    example = {
        "method": "deletion",
        "scenario": "You collect 15 berries! Then you eat 5 of them. How many do you have left?",
        "solution": "The problem asks to find the amount of berries you have left after eating 5. This represents a subtraction problem. We start with 15 berries. Then we subtract 5 of them. So, we have 15 - 5 = 10 left.",
        "asset": "berries",
        "originalCount": 15,
        "solutionCount": 10,
    }

    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"You are a helpful agent who can construct an interactive problem from the following math question: {question}. You must create a realistic scenario that mathematically represents the math question. The representation should be in the form of images the user must click to delete an image. For example, if a user asks whats 15 - 5, we get {example}\n"
        "INPUT: a single math question string.\n"
        "OUTPUT: STRICT JSON matching the schema below. Do not include any text outside JSON.\n"
        "SCHEMA:\n"
        "{\n"
        '  "method": "deletion"\n'
        '  "scenario": string,                 // ≤ 60 words, real-world context only\n'
        '  "solution": string,                 // explain how the user could use math to solve the problem\n'
        '  "asset": string                     // the object being deleted\n'
        '  "originalCount": int                // the number of objects before deletion\n'
        '  "solutionCount": int                // the number of objects after deletion\n'
        "}\n"
        "CONSTRAINTS:\n"
        "- If the question is ambiguous, choose a reasonable, common K-12 interpretation.\n"
        "VALIDATION:\n"
        "- solutionCount <= originalCount"
        "Return a dictionary only",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0) # Disables thinking
        )
    )

    return response.text


def division(question: str) -> dict | str:
    """Constructs a representation of a math problem that requires a user to divide objects into groups.

    Args:
        question: The math problem that needs to be represented and solved.

    Returns:
        dict: method, scenario, assets.
        str: method, scenario, assets.
    """

    example = {
        "method": "division",
        "scenario": "You have 12 cookies. If you need to share the cookies among 4 chilren, how many cookies does each child get?",
        "solution": "The problem asks to find the amount of cookies each child gets if the cookies are shared. This naturally represents a division problem where we have 12 cookie objects and 4 children groups. A user must drag 3 cookies into the 4 children groups to represent 4 ",
        "origin": "cookie",
        "originCount": 12,
        "group": "child",
        "groupCount": 4
    }

    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"You are a helpful agent who can construct an interactive problem from the following math question: {question}. You must create a realistic scenario that mathematically represents the math question. The representation should be in the form of images the user must click to delete an image. For example, if a user asks whats 15 - 5, we get {example}\n"
        "INPUT: a single math question string.\n"
        "OUTPUT: STRICT JSON matching the schema below. Do not include any text outside JSON.\n"
        "SCHEMA:\n"
        "{\n"
        '  "method": "division"\n'
        '  "scenario": string,                 // ≤ 60 words, real-world context only\n'
        '  "solution": string,                 // explain how the user could use math to solve the problem\n'
        '  "origin": string                    // The object that is being distributed\n'
        '  "originCount": int                  // the number of objects\n'
        '  "group": string                     // The name of the group the items are being distrubted to\n'
        '  "groupCount: int                    // The number of groups.'
        "}\n"
        "CONSTRAINTS:\n"
        "- No equations or explanations in the JSON; the scenario carries the story.\n"
        "- If the question is ambiguous, choose a reasonable, common K-12 interpretation.\n"
        "VALIDATION:\n"
        "Return a dictionary only",
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0) # Disables thinking
        )
    )

    return response.text

    
root_agent = Agent(
    name="education_agent",
    model="gemini-2.0-flash",
    description=(
        "Routes a user math question to the best interactive representation tool. "
    ),
    instruction=("""
    When a user asks a math question:
    1. Identify the math problem that needs to be modeled.
    2. Decide which tool best models the mathematical concept.
    3. Execute that tool by passing in the math problem.
    4. Return the result as a string representation of the dictionary.
    """
    ),
    tools=[addition, deletion, division],
)

