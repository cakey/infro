import random
import json

data_items = []
for _ in range(5000):
    data_item = {}
    data_item["to"] = random.choice(["database", "cache", "application", "monitoring", "admin"])
    data_item["byte_out"] = random.randint(10, 1000) ** 2
    data_item["byte_in"] = random.randint(100, 2000)
    data_item["duration"] = int(data_item["byte_out"] * random.random() * 2)
    data_item["request"] = '/'.join(random.sample(["user", "post", "event", "friend"], random.randint(1,4)))
    data_item["response_code"] = 200
    data_item["time"] = 1349306022 - random.randint(0,500000)
    data_items.append(data_item)
    
with open('data.json', 'w') as jsonfile:
    jsonfile.write(json.dumps(data_items, indent=4))