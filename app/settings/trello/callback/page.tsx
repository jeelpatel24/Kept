// Trello return_url target: token arrives in the URL fragment (#token=...). Client reads it and POSTs to the server,
// which verifies + encrypts it. The token is never logged or persisted client-side. Implements: TRD-3.7, TRD-5.2.
import { TrelloCallback } from "@/components/TrelloCallback";

export default function TrelloCallbackPage() {
  return <TrelloCallback />;
}
