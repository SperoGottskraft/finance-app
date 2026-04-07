import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";

export function PlaidLinkButton({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchToken() {
    setLoading(true);
    setError("");
    try {
      const res = await api.plaid.createLinkToken();
      setLinkToken(res.link_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken, metadata) => {
      try {
        await api.plaid.exchangeToken({
          public_token: publicToken,
          institution_id: metadata.institution?.institution_id ?? "",
          institution_name: metadata.institution?.name ?? "",
        });
        onSuccess?.();
      } catch (err) {
        setError(err.message);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div>
      <Button
        variant="primary"
        onClick={fetchToken}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Connect Bank Account
      </Button>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
