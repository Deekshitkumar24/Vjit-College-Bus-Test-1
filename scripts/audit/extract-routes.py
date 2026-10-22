import glob, re, os

controller_files = glob.glob('services/api/src/**/*.controller.ts', recursive=True)

# NestJS global prefix defined in services/api/src/main.ts
GLOBAL_PREFIX = "/api/v1"

routes = []

for file_path in controller_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match @Controller('prefix') followed by class definition
    class_blocks = re.split(r'@Controller\(\s*(?:[\'"]([^\'"]*)[\'"])?\s*\)', content)
    i = 1
    while i < len(class_blocks):
        prefix = (class_blocks[i] or "").strip('/')
        body = class_blocks[i+1]
        
        pattern = r"@(Get|Post|Put|Patch|Delete)\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)\s*(?:@[A-Za-z0-9_()]+\s*)*\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\("
        matches = re.finditer(pattern, body)
        for m in matches:
            http_method = m.group(1).upper()
            sub_path = (m.group(2) or "").strip('/')
            fn_name = m.group(3)

            full_path = GLOBAL_PREFIX
            if prefix:
                full_path += "/" + prefix
            if sub_path:
                full_path += "/" + sub_path

            full_path = re.sub(r'/+', '/', full_path)
            routes.append({
                'method': http_method,
                'path': full_path,
                'file': os.path.basename(file_path),
                'handler': fn_name
            })
        i += 2

print(f"Total routes discovered from NestJS controller decorators (with {GLOBAL_PREFIX}): {len(routes)}")

# Read verify-routes-auth.ts routes
verifier_routes = []
with open('scripts/verify-routes-auth.ts', 'r', encoding='utf-8') as f:
    text = f.read()
    v_matches = re.findall(r"method:\s*['\"]([A-Z]+)['\"],\s*path:\s*['\"]([^'\"]+)['\"]", text)
    verifier_routes = [{'method': m[0], 'path': m[1]} for m in v_matches]

print(f"Total routes in verify-routes-auth inventory: {len(verifier_routes)}")

controller_set = {(r['method'], r['path']) for r in routes}
verifier_set = {(r['method'], r['path']) for r in verifier_routes}

diff = controller_set.symmetric_difference(verifier_set)
if not diff:
    print("\nPERFECT MATCH: All 30 routes from controller decorators match verify-routes-auth inventory 1:1!")
else:
    print(f"\nMismatch count: {len(diff)}")
    print("In controllers but not verifier:", controller_set - verifier_set)
    print("In verifier but not controllers:", verifier_set - controller_set)

print("\n--- Discovered Controller Routes List (30) ---")
for r in sorted(routes, key=lambda x: (x['path'], x['method'])):
    print(f"  {r['method']:<6} {r['path']:<38} [{r['file']}::{r['handler']}]")
