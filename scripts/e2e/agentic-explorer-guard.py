"""Apply a narrow local-only network guard to Agentic Test Explorer's runner."""
import os
from pathlib import Path


source = Path(os.environ.get("AGENT_EXPLORER_DIR", "")) / "src/agentic_explorer/main.py"
if not source.is_file():
    raise SystemExit("Set AGENT_EXPLORER_DIR to the Agentic Test Explorer checkout")
text = source.read_text(encoding="utf-8")
marker = "# TAI_EMULATOR_NETWORK_GUARD"
url_marker = "# TAI_EMULATOR_APP_URL"
url_anchor = "    cfg = load_app_config()\n"
if url_marker not in text:
    if text.count(url_anchor) != 1:
        raise SystemExit("Unrecognized Agentic Test Explorer config setup; no files changed")
    text = text.replace(
        url_anchor,
        url_anchor
        + '    # TAI_EMULATOR_APP_URL: override any configured production URL for this isolated run.\n'
        + '    if os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1":\n'
        + '        cfg.app.url = os.getenv("TAI_LOCAL_APP_URL", "http://127.0.0.1:4187")\n',
    )
if marker not in text:
    anchor = "        context.set_default_timeout(5000)\n"
    if text.count(anchor) != 1:
        raise SystemExit("Unrecognized Agentic Test Explorer version; no files changed")
guard = '''        # TAI_EMULATOR_NETWORK_GUARD: browser traffic is limited to local TAI and emulator ports.
        if os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1":
            from urllib.parse import urlparse

            async def _tai_route_guard(route):
                request = route.request
                url = urlparse(request.url)
                local = url.hostname in {"127.0.0.1", "localhost", "::1"} and url.port in {4187, 9099, 8080}
                google_asset = url.hostname == "apis.google.com" and request.method == "GET" and (url.path == "/js/api.js" or url.path.startswith("/_/scs/"))
                if local or google_asset:
                    await route.continue_()
                else:
                    print(f"BLOCKED external request: {url.scheme}://{url.hostname}{url.path}")
                    await route.abort("blockedbyclient")

            await context.route("**/*", _tai_route_guard)

'''
if marker not in text:
    text = text.replace(anchor, guard + anchor)
patterns = [
    "browser.new_context(no_viewport=True, ignore_https_errors=True)",
    'browser.new_context(storage_state="auth.json", no_viewport=True, ignore_https_errors=True)',
]
for pattern in patterns:
    if pattern in text:
        text = text.replace(pattern, pattern[:-1] + ', service_workers="block")')
    elif pattern[:-1] + ', service_workers="block")' not in text:
        raise SystemExit("Unrecognized Agentic Test Explorer context setup; no files changed")
# Keep worker results as deltas; the parent graph already retains the history.
graph_source = source.parent / "orchestration/graph_base.py"
graph_text = graph_source.read_text(encoding="utf-8")
delta_marker = "# TAI_EMULATOR_MESSAGE_DELTAS"
if delta_marker not in graph_text:
    delta_anchor = '        new_messages: Sequence[BaseMessage] = out.get("messages", [])\n'
    if graph_text.count(delta_anchor) != 1:
        raise SystemExit("Unrecognized Explorer message result; no files changed")
    graph_text = graph_text.replace(delta_anchor, delta_anchor + '''        # TAI_EMULATOR_MESSAGE_DELTAS
        import os as _tai_os
        if _tai_os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1":
            new_messages = list(new_messages)[len(filtered_state.get("messages", [])):]
''')
    turn_anchor = '        out: dict = {}\n'
    if graph_text.count(turn_anchor) != 1:
        raise SystemExit("Unrecognized Explorer worker input; no files changed")
    graph_text = graph_text.replace(turn_anchor, '''        import os as _tai_os
        if _tai_os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1":
            filtered_state.setdefault("messages", []).append(HumanMessage(content=(
                "A new worker turn starts now. Previous agent reports are historical context, "
                "not your answer. Use browser tools to inspect the current DOM and perform "
                "a new mission action in an area not yet covered. Do not repeat a previous "
                "worker's conclusion without fresh evidence."
            )))
''' + turn_anchor)
    rules_anchor = 'def make_agent_node('
    if graph_text.count(rules_anchor) != 1:
        raise SystemExit("Unrecognized Explorer browser policy; no files changed")
    graph_text = graph_text.replace(rules_anchor, '''# Evidence policy for the emulator-only adapter; ordinary Explorer runs keep their policy.
import os as _tai_policy_os
if _tai_policy_os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1":
    BROWSER_AGENT_RULES += (
        " Evidence override: a timeout on a guessed or nonexistent selector, or on a "
        "responsive element hidden by design, is an agent execution error. Recover "
        "using the observed DOM. Report an application defect only with an observed "
        "element, a justified expected behavior, and reproducible actual behavior."
    )

''' + rules_anchor)

graph_text = graph_text.replace('        seen_count = 0\n', '        seen_count = len(filtered_state.get("messages", [])) if _tai_os.getenv("TAI_AGENT_EMULATOR_ONLY") == "1" else 0\n')

source.write_text(text, encoding="utf-8")
graph_source.write_text(graph_text, encoding="utf-8")
print(f"Installed emulator-only app URL and network guard in {source}")
