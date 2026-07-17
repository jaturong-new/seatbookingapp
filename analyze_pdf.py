import re
import json

def parse_html(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    matches = re.findall(r'<word xMin="([0-9.]+)" yMin="([0-9.]+)" xMax="([0-9.]+)" yMax="([0-9.]+)">([^<]+)</word>', content)
    
    seats = []
    seat_pattern = re.compile(r'^F(24|32|5)-([A-Z])([0-9]+)$')
    for xMin, yMin, xMax, yMax, text in matches:
        text = text.strip()
        m = seat_pattern.match(text)
        if m:
            floor = "F" + m.group(1)
            letter = m.group(2)
            number = int(m.group(3))
            seats.append({
                'full_code': text,
                'floor_code': floor,
                'row_letter': letter,
                'col_number': number,
                'x': float(xMin),
                'y': float(yMin)
            })
    return seats

def cluster_and_assign_indices(values, tolerance, step_divisor):
    values = sorted(list(set(values)))
    if not values: return [], []
    
    clusters = []
    current_cluster = [values[0]]
    for v in values[1:]:
        if v - current_cluster[-1] <= tolerance:
            current_cluster.append(v)
        else:
            clusters.append(current_cluster)
            current_cluster = [v]
    clusters.append(current_cluster)
    
    means = [sum(c)/len(c) for c in clusters]
    
    indices = [0]
    for i in range(1, len(means)):
        gap = means[i] - means[i-1]
        steps = max(1, round(gap / step_divisor))
        indices.append(indices[-1] + steps)
        
    return clusters, indices

def get_cluster_index(val, clusters, indices):
    for i, c in enumerate(clusters):
        if val in c:
            return indices[i]
    return -1

def process_floor(seats, floor_code, x_tol, y_tol, x_step, y_step):
    floor_seats = [s for s in seats if s['floor_code'] == floor_code]
    if not floor_seats: return []
    
    xs = [s['x'] for s in floor_seats]
    ys = [s['y'] for s in floor_seats]
    
    x_clusters, x_indices = cluster_and_assign_indices(xs, x_tol, x_step)
    y_clusters, y_indices = cluster_and_assign_indices(ys, y_tol, y_step)
    
    # normalize so min index is 0
    min_x = min(x_indices)
    min_y = min(y_indices)
    x_indices = [idx - min_x for idx in x_indices]
    y_indices = [idx - min_y for idx in y_indices]
    
    for s in floor_seats:
        s['grid_row'] = get_cluster_index(s['y'], y_clusters, y_indices)
        s['grid_col'] = get_cluster_index(s['x'], x_clusters, x_indices)
        
    return floor_seats

def main():
    seats = parse_html('/tmp/seats.html')
    
    # x_step=25 (adj gap ~20, corridor ~45)
    # y_step=15 (rows are packed close)
    all_processed = []
    for floor in ['F5', 'F24', 'F32']:
        all_processed.extend(process_floor(seats, floor, x_tol=10, y_tol=4, x_step=25, y_step=15))
        
    with open('data/seed.json', 'r', encoding='utf-8') as f:
        seed_data = json.load(f)
        
    # update seats
    new_seats = []
    for s in seed_data['seats']:
        # find matching processed seat
        ps = next((x for x in all_processed if x['full_code'] == s['full_code']), None)
        if ps:
            s['grid_row'] = ps['grid_row']
            s['grid_col'] = ps['grid_col']
        new_seats.append(s)
        
    seed_data['seats'] = new_seats
    
    with open('data/seed.json', 'w', encoding='utf-8') as f:
        json.dump(seed_data, f, indent=2, ensure_ascii=False)
        
    print("Updated data/seed.json successfully.")

if __name__ == '__main__':
    main()
