# pi-ide

IDE-style code intelligence for the Pi coding agent.

This package is a maintained local fork of `pi-shazam@0.3.2`, derived from the MIT-licensed npm tarball. It keeps the existing `shazam_*` tool names for compatibility, but changes the safety defaults for large workspaces:

- startup overview scanning is disabled by default
- post-edit auto-verify scanning is disabled by default
- large generated/reference directories are skipped by default
- extra skip directories can be configured with env vars or `.pi-ide.json`

## Install

```bash
pi install /workspace/wip/wt/pi-ide
```

## Safety Defaults

Automatic scans are off unless explicitly enabled:

```bash
PI_IDE_AUTO_OVERVIEW=1 pi
PI_IDE_AUTO_VERIFY=1 pi
```

Additional skip directories can be configured with an environment variable:

```bash
PI_IDE_SKIP_DIRS=".tmp,refs,wip,.archives"
```

Or with `.pi-ide.json` in the project root:

```json
{
  "skipDirs": [".tmp", "refs", "wip", ".archives", ".meta", "sessions", "report"]
}
```

## Tools

The tool names remain compatible with the upstream package:

- `shazam_overview`
- `shazam_impact`
- `shazam_codesearch`
- `shazam_symbol`
- `shazam_hover`
- `shazam_file_detail`
- `shazam_call_chain`
- `shazam_find_tests`
- `shazam_hotspots`
- `shazam_type_hierarchy`
- `shazam_verify`
- `shazam_fix`
- `shazam_rename_symbol`
- `shazam_safe_delete`

## Provenance

Derived from `pi-shazam@0.3.2`, published by `gjczone` under the MIT license. The npm metadata references `https://github.com/gjczone/pi-shazam`, but that repository was not publicly available when this fork was created. The related public upstream project appears to be `https://github.com/gjczone/repomap`.
