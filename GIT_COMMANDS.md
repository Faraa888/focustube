# Quick Git Commands

## Quick Push (Copy & Paste)

```bash
git add . && git commit -m "Your commit message here" && git push origin main
```

## Or use the script

```bash
./quick-push.sh "Your commit message here"
```

## Step by step (if you want to review first)

```bash
# 1. See what changed
git status

# 2. Add all changes
git add .

# 3. Commit
git commit -m "Your commit message here"

# 4. Push
git push origin main
```

## Common Commit Messages

- `"Fix: [what you fixed]"`
- `"Add: [what you added]"`
- `"Update: [what you updated]"`
- `"Refactor: [what you refactored]"`

## Examples

```bash
git add . && git commit -m "Fix email storage from website" && git push origin main
```

```bash
git add . && git commit -m "Add logout button to header" && git push origin main
```

```bash
git add . && git commit -m "Update extension messaging API" && git push origin main
```

