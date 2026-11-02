"""Repair only interchange dimensions; retain anchors, labels and user data."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'shenzhen/.ocr-deps'))
sys.path.insert(0, str(ROOT / 'shenzhen/scripts'))
import numpy as np
from PIL import Image
from transfer_symbol_geometry import measure_transfer_symbols

check = '--check' in sys.argv
pending = []
for city in ('hangzhou', 'shaoxing'):
    folder = ROOT / city
    source = folder / f'public/maps/{city}-reference-pure.jpg'
    image = np.asarray(Image.open(source).convert('RGB'))
    path = folder / 'data/station-symbols.json'
    symbols = json.loads(path.read_text(encoding='utf-8'))
    override_path = folder / 'scripts/transfer-symbol-overrides.json'
    reviewed = json.loads(override_path.read_text(encoding='utf-8')) if override_path.exists() else {}
    topology_path = folder / 'scripts/transfer-topology-overrides.json'
    topology = json.loads(topology_path.read_text(encoding='utf-8')) if topology_path.exists() else {}
    repaired, measurements = measure_transfer_symbols(image, {**symbols, **topology}, reviewed)
    changed = [name for name in symbols if symbols[name] != repaired[name]]
    if check and changed:
        raise ValueError(f'{city}: dimensions differ from source outer rings: {changed}')
    audit = {'source': source.relative_to(ROOT).as_posix(), 'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
             'transferCount': len(measurements),
             'measurements': [{key: value for key, value in row.items() if key != 'before'} for row in measurements]}
    pending.append((path, repaired, folder / 'scripts/transfer-symbol-review.json', audit))
    print(f'{city}: checked {len(measurements)} interchange symbols, {len(changed)} corrections')

if not check:
    for path, repaired, report_path, audit in pending:
        path.write_text(json.dumps(repaired, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        report_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
