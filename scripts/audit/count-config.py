import re

# Read strictly from the contract file AG-MASTER-FINAL-1.0.md
with open('AG-MASTER-FINAL-1.0.md', 'r', encoding='utf-8') as f:
    contract_text = f.read()

# 1. Parse Part 14.4 (Configuration defaults)
idx14 = contract_text.find('14.4 Configuration defaults')
idx15 = contract_text.find('14.5 Observability', idx14)
# Note that Part 14.4 table continues across pages 78, 79, 80 before 14.6
idx16 = contract_text.find('14.6 Non-functional requirements', idx15)
p14_text = contract_text[idx14:idx15] + "\n" + contract_text[idx15:idx16]

# Extract keys with pattern: <key_name>: <value>
# E.g. hw.stale_after_s: 60
p14_raw = re.findall(r'([a-z0-9_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*:', p14_text)
p14_keys = set(p14_raw)
if 'holidays:' in p14_text:
    p14_keys.add('holidays')

# 2. Parse Part 20.17 (Configuration keys added)
idx20 = contract_text.find('20.17 Configuration keys added')
idx21 = contract_text.find('Part 21. Amendments', idx20)
p20_text = contract_text[idx20:idx21]

p20_raw = re.findall(r'([a-z0-9_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*:', p20_text)
p20_keys = set(p20_raw)

contract_keys = p14_keys.union(p20_keys)

# 3. Parse Code keys from packages/config/src/defaults.ts
with open('packages/config/src/defaults.ts', 'r', encoding='utf-8') as f:
    code_text = f.read()
code_keys = set(re.findall(r"'([a-z0-9_.]+)':", code_text))

diff_extra = sorted(list(code_keys - contract_keys))
diff_missing = sorted(list(contract_keys - code_keys))

print(f"Part 14.4 contract keys count: {len(p14_keys)}")
print(f"Part 20.17 contract keys count: {len(p20_keys)}")
print(f"Total unique contract keys (14.4 + 20.17): {len(contract_keys)}")
print(f"Total keys seeded in packages/config/src/defaults.ts: {len(code_keys)}")
print(f"Extra keys in code not in Part 14.4 or 20.17 ({len(diff_extra)}):")
for k in diff_extra:
    print(f"  - {k}")

if diff_missing:
    print(f"\nMissing contract keys in defaults.ts ({len(diff_missing)}):")
    for k in diff_missing:
        print(f"  - {k}")
else:
    print("\nAll contract keys are present in defaults.ts (0 missing).")
