"""Measure capsule outer rings, never their nested white/colored interiors."""
import copy
import math

import cv2
import numpy as np


def measure_transfer_symbols(image, symbols, reviewed=None):
    reviewed = reviewed or {}
    result = copy.deepcopy(symbols)
    rings = []
    for threshold in (180, 140, 100):
        mask = ((image.max(2) < threshold) & (image.max(2) - image.min(2) < 40)).astype(np.uint8)
        contours, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        for index, contour in enumerate(contours):
            # A white hole is nested under its black outer ring. Selecting the
            # nearest contour alone can pick that hole and shrink the station.
            if hierarchy[0][index][3] != -1 or hierarchy[0][index][2] < 0:
                continue
            center, (width, height), angle = cv2.minAreaRect(contour)
            area = cv2.contourArea(contour)
            if not (9 <= min(width, height) <= max(width, height) <= 32 and 90 <= area <= 500):
                continue
            if area / (width * height) < .7:
                continue  # Reject a ring joined to text or a passage tail.
            if width < height:
                width, height, angle = height, width, angle + 90
            candidates.append((center, width, height, angle, area))
        rings.append((threshold, candidates))

    report = []
    for name, geometry in result.items():
        for index, part in enumerate(geometry['parts']):
            if not part.get('transfer'):
                continue
            before = {key: part[key] for key in ('width', 'height', 'angle')}
            if geometry.get('joined'):
                # Reviewed circles share an outer contour. Do not fit that
                # combined contour back into a separate capsule for each part.
                report.append({'station': name, 'part': index, 'before': before,
                               'measured': before.copy(), 'method': 'reviewed-circle-union'})
                continue
            if name in reviewed:
                measurement = reviewed[name]
                after = {key: measurement[key] for key in before}
                evidence = {'method': 'reviewed-source-ring', 'reason': measurement['reason']}
            else:
                for threshold, candidates in rings:
                    matches = [candidate for candidate in candidates if math.dist(candidate[0], (part['x'], part['y'])) <= 2.5]
                    if not matches:
                        continue
                    center, width, height, angle, area = max(matches, key=lambda item: item[4])
                    after = dict(zip(before, (round(width, 2), round(height, 2), round(angle, 2))))
                    evidence = {'method': 'outer-ring-contour', 'threshold': threshold,
                                'centerDistance': round(math.dist(center, (part['x'], part['y'])), 3),
                                'contourArea': area}
                    break
                else:
                    raise ValueError(f'{name}: no separate outer ring; source-image review required')
            part.update(after)
            report.append({'station': name, 'part': index, 'before': before, 'measured': after, **evidence})
    return result, report
