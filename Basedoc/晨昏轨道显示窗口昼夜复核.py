import json, math
import numpy as np
from astropy.time import Time
from astropy.coordinates import GCRS, ITRS, EarthLocation, AltAz, get_sun
import astropy.units as u
from astropy.utils import iers
iers.conf.auto_download = False; iers.conf.auto_max_age = None

LAT, LON = 31.8206, 117.2272
obs = EarthLocation.from_geodetic(lon=LON*u.deg, lat=LAT*u.deg, height=10*u.m)
RE = 6378.137

# 报告表：三星共同几何可见窗口，UTC 2026-09-13
wins = [("窗口1", 17756, 18150), ("窗口2", 23479, 23878), ("窗口3", 65901, 66403)]
t0 = Time("2026-09-13 04:00:00", scale='utc')

def sun_alt(times):
    s = get_sun(times)
    return s.transform_to(AltAz(location=obs, obstime=times)).alt.deg

# --- 独立复核零地影：用报告要素两体传播，判卫星是否落入地影圆柱 ---
A, MU = 6978.137, 398600.4418
I = math.radians(97.787669525); RAAN = math.radians(260.833199252)
n = math.sqrt(MU/A**3)
tt = np.arange(0, 86401, 10.0)
u_ = n*tt
cn, sn, ci, si = math.cos(RAAN), math.sin(RAAN), math.cos(I), math.sin(I)
P = np.stack([A*(cn*np.cos(u_) - sn*np.sin(u_)*ci),
              A*(sn*np.cos(u_) + cn*np.sin(u_)*ci),
              A*(np.sin(u_)*si)])                       # J2000 GCRS, km
tm_arr = t0 + tt*u.s
sun = get_sun(tm_arr).transform_to(GCRS(obstime=tm_arr))
S = np.stack([sun.cartesian.x.to(u.km).value, sun.cartesian.y.to(u.km).value, sun.cartesian.z.to(u.km).value])
S = S / np.linalg.norm(S, axis=0)                        # 地心指向太阳的单位矢量
along = np.sum(S * P, axis=0)                            # 卫星位置在日地方向上的投影，负值表示在背阳侧
anti = -along
perp = np.linalg.norm(P - S * along[None, :], axis=0)    # 到日地连线的垂直距离
ecl = (anti > 0) & (perp < RE)

# --- 各窗口内太阳高度 ---
rows = []
for name, a, b in wins:
    for tag, s in (("开始", a), ("结束", b)):
        t = t0 + s*u.s
        rows.append({"窗口": name, "端点": tag, "UTC": t.iso,
                     "合肥太阳高度_deg": round(float(sun_alt(t)), 2)})
# 当天合肥太阳过零与昏影终
day = t0 + np.arange(0, 86401, 30.0)*u.s
alt = sun_alt(day)
def cross(thr):
    idx = np.where(np.diff(np.sign(alt - thr)))[0]
    return [int((day[i] - t0).sec) for i in idx]  # 距 04:00 UTC 的秒数
out = {
  "共同可见窗口内合肥太阳高度": rows,
  "合肥当天太阳高度过零时刻_距04UTC秒": {"0度": cross(0.0), "-6度民用昏影": cross(-6.0), "-12度天文昏影": cross(-12.0)},
  "独立复核地影": {"本影采样点数": int(ecl.sum()), "总采样": len(tt),
              "最接近地影时到日地连线垂直距离_km": round(float(perp[anti>0].min()),1) if (anti>0).any() else None,
              "该处反太阳投影_km": round(float(anti[anti>0][np.argmin(perp[anti>0])]),1) if (anti>0).any() else None,
              "地球半径_km": RE},
  "口径说明": "两体不含 J2/大气/光压，仅用于复核零地影这一几何结论；太阳位置用 astropy 内置低精度模型，判昼夜足够"
}
with open("E:/tmp/sunshadow.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("OK")
