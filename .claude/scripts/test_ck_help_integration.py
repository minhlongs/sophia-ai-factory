#!/usr/bin/env python3
"""Integration tests for ck-help.py using real user queries and edge cases."""

import pytest
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "ck-help.py"


def run_ck_help(query: str) -> str:
    """Run ck-help.py with query and return output."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)] + query.split(),
        capture_output=True,
        text=True
    )
    return result.stdout


def check_category(query: str, expected_category: str) -> bool:
    """Check if query routes to expected category via keywords in output."""
    output = run_ck_help(query).lower()
    # Check various markers that indicate the category
    markers = {
        "notifications": ["discord", "telegram", "slack", "webhook", "notify", "session notifications"],
        "git": ["commit", "push", "pr", "merge", "/git:", "git workflow"],
        "test": ["/test", "run tests", "fix failures", "testing"],
        "fix": ["/fix", "/debug", "fixing issues"],
        "bootstrap": ["/bootstrap", "project setup", "quick start"],
        "config": [".ck.json", "global", "local", "configuration"],
        "plan": ["/plan", "planning", "research"],
        "cook": ["/cook", "implementation", "implement"],
        "review": ["/review", "code review", "audit"],
        "design": ["/design", "ui", "ux"],
        "task": ["recommended", "workflow", "task recommendations", "not sure about", "try being more specific"],  # Unknown queries → task recommendations
    }

    expected_markers = markers.get(expected_category, [expected_category])
    return any(marker in output for marker in expected_markers)


# Real user queries - typos
TYPO_TESTS = [
    ("notificatons setup", "notifications"),  # missing 'i'
    ("notifcations", "notifications"),  # transposition
    ("discrod webhook", "notifications"),  # discord typo
    ("tset my code", "test"),  # test typo - 'tset'
    ("comit changes", "git"),  # commit typo
    ("configre discord", "notifications"),  # configure typo
]

# Synonym tests
SYNONYM_TESTS = [
    ("setup alerts", "notifications"),  # alerts → notifications
    ("run specs", "test"),  # specs → tests
    ("create pr", "git"),  # pr → pull request
    ("check deps", "test"),  # deps → dependencies, check → run tests
]

# Descriptive phrase tests
PHRASE_TESTS = [
    ("how do I send discord notifications", "notifications"),
    ("I want to commit my changes", "git"),
    ("need to test my login page", "test"),
    ("fix broken authentication", "task"),  # Unknown → task recommendations
    ("start a new react project", "bootstrap"),
]

# Edge cases
EDGE_TESTS = [
    ("configure discord", "notifications"),  # service-specific
    ("telegram bot", "notifications"),  # service-specific
    ("slack webhook", "notifications"),  # service-specific
    ("discord webhook", "notifications"),  # explicit compound
]


@pytest.mark.parametrize("query,expected_category", TYPO_TESTS + SYNONYM_TESTS + PHRASE_TESTS + EDGE_TESTS)
def test_routes_to_category(query: str, expected_category: str) -> None:
    """Check if query routes to expected category via keywords in output."""
    assert check_category(query, expected_category), \
        f"Query '{query}' did not route to '{expected_category}'"


def test_ck_help_script_exists() -> None:
    """Verify ck-help.py script exists."""
    assert SCRIPT.exists(), f"Script not found: {SCRIPT}"
