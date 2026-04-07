"""
Plaid service — plaid-python v14+ API.
Gracefully handles missing credentials so the rest of the app still works.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)

# Lazy-initialised client so import doesn't fail when credentials are absent
_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
        raise ValueError("Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in .env")

    try:
        import plaid
        from plaid.api import plaid_api
        from plaid.configuration import Configuration
        from plaid.api_client import ApiClient

        env_map = {
            "sandbox": plaid.Environment.Sandbox,
            "development": plaid.Environment.Development,
            "production": plaid.Environment.Production,
        }
        configuration = Configuration(
            host=env_map.get(settings.PLAID_ENV, plaid.Environment.Sandbox),
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            },
        )
        _client = plaid_api.PlaidApi(ApiClient(configuration))
        return _client
    except ImportError as exc:
        raise ImportError("plaid-python is not installed. Run: pip install plaid-python") from exc


def create_link_token(user_id: str = "local-user") -> str:
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products
    from plaid.model.country_code import CountryCode

    client = get_client()
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Finance Dashboard",
        country_codes=[CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
    )
    response = client.link_token_create(request)
    return response["link_token"]


def exchange_public_token(public_token: str) -> dict[str, str]:
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = get_client()
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return {
        "access_token": response["access_token"],
        "item_id": response["item_id"],
    }


def get_accounts(access_token: str) -> list[dict[str, Any]]:
    from plaid.model.accounts_get_request import AccountsGetRequest

    client = get_client()
    response = client.accounts_get(AccountsGetRequest(access_token=access_token))
    accounts = []
    for acct in response["accounts"]:
        accounts.append({
            "plaid_account_id": acct["account_id"],
            "name": acct["name"],
            "institution": None,
            "account_type": str(acct.get("type", "depository")),
            "account_subtype": str(acct.get("subtype", "")),
            "currency": acct.get("balances", {}).get("iso_currency_code", "USD") or "USD",
            "balance_current": float(acct.get("balances", {}).get("current") or 0),
            "balance_available": (
                float(acct["balances"]["available"])
                if acct.get("balances", {}).get("available") is not None
                else None
            ),
        })
    return accounts


def sync_transactions(access_token: str, cursor: str | None) -> dict[str, Any]:
    """
    Uses /transactions/sync (cursor-based incremental sync).
    Returns {"added": [...], "modified": [...], "removed": [...], "next_cursor": str}
    """
    from plaid.model.transactions_sync_request import TransactionsSyncRequest

    client = get_client()
    added_all, modified_all, removed_all = [], [], []
    current_cursor = cursor or ""
    has_more = True

    while has_more:
        request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=current_cursor,
        )
        response = client.transactions_sync(request)
        added_all.extend(response["added"])
        modified_all.extend(response["modified"])
        removed_all.extend(response["removed"])
        has_more = response["has_more"]
        current_cursor = response["next_cursor"]

    def _to_dict(t) -> dict[str, Any]:
        return {
            "plaid_transaction_id": t["transaction_id"],
            "plaid_account_id": t["account_id"],
            "amount": float(t["amount"]),  # Plaid: positive = debit/expense
            "description": t.get("name", ""),
            "merchant_name": t.get("merchant_name"),
            "date": datetime.combine(t["date"], datetime.min.time()).replace(tzinfo=timezone.utc),
            "pending": t.get("pending", False),
            "category": t.get("category", []),
        }

    return {
        "added": [_to_dict(t) for t in added_all],
        "modified": [_to_dict(t) for t in modified_all],
        "removed": [t["transaction_id"] for t in removed_all],
        "next_cursor": current_cursor,
    }
