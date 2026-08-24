// Deploy smoke check (Plan Stage 0 exit: "deployed empty app"). No secrets returned.
export async function GET() {
  return Response.json({ ok: true, app: "kept", time: new Date().toISOString() });
}
