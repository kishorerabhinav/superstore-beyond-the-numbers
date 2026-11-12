"""Independent validation: loads data/orders.csv into SQLite (stdlib only) and computes the reference
numbers with SQL. Writes docs/validation-reference.json, which the TypeScript engine's tests compare against."""
import csv, json, sqlite3, sys
con = sqlite3.connect(":memory:")
rows = list(csv.DictReader(open("data/orders.csv", encoding="utf-8")))
con.execute("create table o(row_id int, order_id text, order_date text, ship_date text, ship_mode text, customer_id text, segment text, country text, city text, state text, region text, product_id text, category text, sub_category text, product_name text, sales real, quantity int, discount real, profit real)")
con.executemany("insert into o values (" + ",".join("?"*19) + ")", [tuple(r.values()) for r in rows])
one = lambda q, *a: con.execute(q, a).fetchone()
ref = {}
s, p, n, od, q, ad = one("select sum(sales), sum(profit), count(*), count(distinct order_id), sum(quantity), avg(discount) from o")
ref["all"] = dict(sales=s, profit=p, lines=n, orders=od, quantity=q, avgDiscount=ad, margin=p/s, aov=s/od,
                  weightedDiscount=one("select sum(discount*sales/(1-discount))/sum(sales/(1-discount)) from o where discount<1")[0])
ref["byYear"] = {y: dict(sales=a, profit=b, orders=c) for y, a, b, c in con.execute("select substr(order_date,1,4) y, sum(sales), sum(profit), count(distinct order_id) from o group by y")}
ys = sorted(ref["byYear"]); ref["yoy2026"] = ref["byYear"][ys[-1]]["sales"] / ref["byYear"][ys[-2]]["sales"] - 1
ref["byCategory"] = {c: dict(sales=a, profit=b, orders=d, avgDiscount=e) for c, a, b, d, e in con.execute("select category, sum(sales), sum(profit), count(distinct order_id), avg(discount) from o group by category")}
ref["bySegment"] = {c: dict(sales=a, profit=b, orders=d) for c, a, b, d in con.execute("select segment, sum(sales), sum(profit), count(distinct order_id) from o group by segment")}
ref["byRegion"] = {c: dict(sales=a, profit=b) for c, a, b in con.execute("select region, sum(sales), sum(profit) from o group by region")}
ref["filtered_2025_West_Technology"] = dict(zip(["sales","profit","orders","lines"], one("select sum(sales), sum(profit), count(distinct order_id), count(*) from o where substr(order_date,1,4)='2025' and region='West' and category='Technology'")))
ref["filtered_Corporate_FirstClass"] = dict(zip(["sales","profit","orders"], one("select sum(sales), sum(profit), count(distinct order_id) from o where segment='Corporate' and ship_mode='First Class'")))
ref["negativeSubCategories"] = [r[0] for r in con.execute("select sub_category from o group by sub_category having sum(profit)<0 order by sum(profit)")]
ref["topProduct"] = list(one("select product_name, sum(sales) s from o group by product_name order by s desc limit 1"))
ref["country"] = {c: n for c, n in con.execute("select country, count(*) from o group by country")}
json.dump(ref, open("docs/validation-reference.json", "w"), indent=1)
a = ref["all"]
print(f"lines {a['lines']} orders {a['orders']} sales {a['sales']:.2f} profit {a['profit']:.2f} margin {a['margin']*100:.2f}% avgDisc {a['avgDiscount']*100:.2f}% AOV {a['aov']:.2f} qty {a['quantity']} yoy {ref['yoy2026']*100:.2f}%")
print("negative:", ref["negativeSubCategories"], "top:", ref["topProduct"])
