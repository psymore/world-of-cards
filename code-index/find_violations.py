import sqlite3
con = sqlite3.connect('code_index.db')
print("domain → infrastructure violations:")
for r in con.execute("""
    SELECT f.path, t.path FROM file_edges fe
    JOIN files f ON f.id = fe.from_file_id
    JOIN files t ON t.id = fe.to_file_id
    WHERE f.module = 'domain' AND t.module = 'infrastructure'
"""):
    print(" ", r[0])
    print("  ->", r[1])
    print()
