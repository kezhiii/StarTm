import math
import csv

# 读取第一组数据（timestamp=20210817053300）
satellites = []
with open(r'E:\project_code\serproject\202412 画巨型星座\Output\test_1.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['timestamp'] == '20210817053300':
            satellites.append({
                'sat_id': int(row['sat_id']),
                'X': float(row['X']),
                'Y': float(row['Y']),
                'Z': float(row['Z'])
            })

print(f"读取到 {len(satellites)} 颗卫星的数据")
print("=" * 80)

# 打印所有卫星坐标
print("\n所有卫星坐标 (公里):")
print(f"{'sat_id':<8} {'X (km)':<20} {'Y (km)':<20} {'Z (km)':<20}")
print("-" * 80)
for sat in satellites:
    print(f"{sat['sat_id']:<8} {sat['X']:<20.6f} {sat['Y']:<20.6f} {sat['Z']:<20.6f}")

# 计算所有卫星对之间的距离
max_dist = 0
max_pair = None
all_dists = []

for i in range(len(satellites)):
    for j in range(i+1, len(satellites)):
        s1 = satellites[i]
        s2 = satellites[j]
        dist = math.sqrt((s1['X']-s2['X'])**2 + (s1['Y']-s2['Y'])**2 + (s1['Z']-s2['Z'])**2)
        all_dists.append((dist, s1['sat_id'], s2['sat_id']))
        if dist > max_dist:
            max_dist = dist
            max_pair = (s1, s2)

# 按距离排序
all_dists.sort(reverse=True)

print("\n" + "=" * 80)
print("编队直径分析")
print("=" * 80)

s1 = max_pair[0]
s2 = max_pair[1]
print(f"\n最远两颗卫星: sat_{s1['sat_id']} 和 sat_{s2['sat_id']}")
print(f"  sat_{s1['sat_id']}: X={s1['X']:.3f}, Y={s1['Y']:.3f}, Z={s1['Z']:.3f} km")
print(f"  sat_{s2['sat_id']}: X={s2['X']:.3f}, Y={s2['Y']:.3f}, Z={s2['Z']:.3f} km")
print(f"  物理距离: {max_dist:.6f} 公里 ({max_dist*1000:.2f} 米)")

# 计算编队中心
center_x = sum(s['X'] for s in satellites) / len(satellites)
center_y = sum(s['Y'] for s in satellites) / len(satellites)
center_z = sum(s['Z'] for s in satellites) / len(satellites)
print(f"\n编队中心坐标: X={center_x:.3f}, Y={center_y:.3f}, Z={center_z:.3f} km")

# 计算每颗卫星到中心的距离
print(f"\n每颗卫星到编队中心的距离:")
for sat in satellites:
    dist_to_center = math.sqrt((sat['X']-center_x)**2 + (sat['Y']-center_y)**2 + (sat['Z']-center_z)**2)
    print(f"  sat_{sat['sat_id']}: {dist_to_center*1000:.2f} 米")

# Top 10 最远卫星对
print(f"\nTop 10 最远卫星对:")
for i, (dist, id1, id2) in enumerate(all_dists[:10]):
    print(f"  {i+1}. sat_{id1} <-> sat_{id2}: {dist*1000:.2f} 米")

# 视觉张角分析
print("\n" + "=" * 80)
print("视觉张角分析")
print("=" * 80)

# 计算编队中心到地心的距离
dist_to_earth_center = math.sqrt(center_x**2 + center_y**2 + center_z**2)
print(f"\n编队中心到地心距离: {dist_to_earth_center:.3f} km")
print(f"地球半径约: 6371 km")
print(f"编队到地面观察者距离约: {dist_to_earth_center - 6371:.3f} km")

# 不同观察距离下的张角
observer_distances = [500, 800, 1000, 1500, 2000]
print(f"\n不同观察距离下的视觉张角:")
print(f"{'观察距离 (km)':<20} {'张角 (度)':<20} {'张角 (角分)':<20} {'张角 (角秒)':<20}")
print("-" * 80)

for d in observer_distances:
    # 张角 = 2 * arctan(直径 / (2 * 距离))
    angle_rad = 2 * math.atan(max_dist / (2 * d))
    angle_deg = math.degrees(angle_rad)
    angle_arcmin = angle_deg * 60
    angle_arcsec = angle_deg * 3600
    print(f"{d:<20} {angle_deg:<20.6f} {angle_arcmin:<20.4f} {angle_arcsec:<20.2f}")

# 与月球对比
print(f"\n" + "=" * 80)
print("与月球对比")
print("=" * 80)
moon_distance = 384400  # km
moon_angular_size = 0.5  # degrees
formation_dist = dist_to_earth_center - 6371  # km
formation_angle_rad = 2 * math.atan(max_dist / (2 * formation_dist))
formation_angle_deg = math.degrees(formation_angle_rad)

print(f"\n月球:")
print(f"  真实距离: {moon_distance:,} km")
print(f"  视觉直径: {moon_angular_size} 度 (约30角分)")

print(f"\n卫星编队:")
print(f"  编队直径: {max_dist*1000:.2f} 米")
print(f"  观察者距离: {formation_dist:.3f} km")
print(f"  视觉张角: {formation_angle_deg:.6f} 度 ({formation_angle_deg*60:.4f} 角分, {formation_angle_deg*3600:.2f} 角秒)")

print(f"\n对比:")
ratio = formation_angle_deg / moon_angular_size
print(f"  卫星编队张角是月球视直径的 {ratio*100:.4f}%")
print(f"  需要放大 {1/ratio:.0f} 倍才能达到月球视大小")

# 人眼分辨率对比（人眼分辨率约1角分）
print(f"\n人眼分辨率参考:")
print(f"  人眼最小分辨角: 约1角分 (60角秒)")
print(f"  该编队张角: {formation_angle_deg*60:.4f} 角分")
if formation_angle_deg * 60 > 1:
    print(f"  >> 该编队在人眼中可见，明显大于人眼分辨极限")
else:
    print(f"  >> 该编队对人眼来说是一个点光源")
