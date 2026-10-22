import re

# Read strictly from the contract file AG-MASTER-FINAL-1.0.md
with open('AG-MASTER-FINAL-1.0.md', 'r', encoding='utf-8') as f:
    contract_text = f.read()

# 1. Parse Part 14.4 (Configuration defaults)
s14 = contract_text.find('### 14.4 Configuration defaults')
e14 = contract_text.find('### 14.5 Observability', s14)
t14 = contract_text[s14:e14].replace(r'\_', '_')

p14_raw = re.findall(r'([a-z0-9_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*:', t14)
p14_keys = set(p14_raw)
if 'holidays:' in t14 or 'holidays' in t14:
    p14_keys.add('holidays')

# 2. Parse Part 20.17 (Configuration keys added)
s20 = contract_text.find('20.17 Configuration keys added')
e20 = contract_text.find('20.18', s20)
if e20 == -1:
    e20 = contract_text.find('Part 21', s20)
t20 = contract_text[s20:e20].replace(r'\_', '_')

p20_raw = re.findall(r'([a-z0-9_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*:', t20)
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
print(f"Extra keys in defaults.ts beyond contract: {len(diff_extra)}")
print(f"Missing contract keys in defaults.ts: {len(diff_missing)}")

if not diff_extra and not diff_missing:
    print("\nPERFECT CONFORMANCE (OV-12 PASS): defaults.ts contains exactly the 79 contract keys (0 extra, 0 missing)!")
else:
    if diff_extra:
        print(f"Extra keys ({len(diff_extra)}):", diff_extra)
    if diff_missing:
        print(f"Missing keys ({len(diff_missing)}):", diff_missing)
