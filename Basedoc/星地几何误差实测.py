import json, math
import numpy as np
from astropy.time import Time
from astropy.coordinates import GCRS, ITRS, EarthLocation, AltAz
import astropy.units as u
from astropy.utils import iers
iers.conf.auto_download = False
iers.conf.auto_max_age = None

A, MU = 6978.137, 398600.4418
I = math.radians(97.787669525)
RAAN = math.radians(260.833199252)
N = math.sqrt(MU / A**3)
RE_KM = 6378.137
DEG = math.pi / 180.0

def date_to_jd(y, mo, d, h, mi, s):
    if mo <= 2: y -= 1; mo += 12
    aa = math.floor(y / 100); b = 2 - aa + math.floor(aa / 4)
    return math.floor(365.25*(y+4716)) + math.floor(30.6001*(mo+1)) + d + b - 1524.5 + (h+mi/60+s/3600)/24

def calc_gmst(jd):
    g = 280.46061837 + 360.98564736629*(jd - 2451545.0)
    return (((g % 360)+360) % 360) * DEG

t0 = Time("2026-09-13 04:00:00", scale='utc', format='iso')
dt = np.arange(0, 86401, 10.0)
u_ = N * dt
cn, sn = math.cos(RAAN), math.sin(RAAN)
ci, si = math.cos(I), math.sin(I)
X = A*(cn*np.cos(u_) - sn*np.sin(u_)*ci)
Y = A*(sn*np.cos(u_) + cn*np.sin(u_)*ci)
Z = A*(np.sin(u_)*si)

tm = t0 + dt * u.s
jd = np.array([date_to_jd(d_.year, d_.month, d_.day, d_.hour, d_.minute,
                          d_.second + d_.microsecond/1e6) for d_ in tm.datetime])
g = calc_gmst(jd)
SX = X*np.cos(g) + Y*np.sin(g)
SY = -X*np.sin(g) + Y*np.cos(g)
SZ = Z.copy()

itrs = GCRS(x=X*u.km, y=Y*u.km, z=Z*u.km, representation_type='cartesian',
            obstime=tm).transform_to(ITRS(obstime=tm))
RX = itrs.cartesian.x.to(u.km).value
RY = itrs.cartesian.y.to(u.km).value
RZ = itrs.cartesian.z.to(u.km).value
err = np.sqrt((SX-RX)**2 + (SY-RY)**2 + (SZ-RZ)**2)

LAT, LON = 31.8206, 117.2272
latR, lonR = LAT*DEG, LON*DEG
xs, ys, zs = RE_KM*math.cos(latR)*math.cos(lonR), RE_KM*math.cos(latR)*math.sin(lonR), RE_KM*math.sin(latR)
dx, dy, dz = SX-xs, SY-ys, SZ-zs
sinL, cosL, sinN, cosN = math.sin(latR), math.cos(latR), math.sin(lonR), math.cos(lonR)
s_ = sinL*cosN*dx + sinL*sinN*dy - cosL*dz
e_ = -sinN*dx + cosN*dy
zu = cosL*cosN*dx + cosL*sinN*dy + sinL*dz
rng = np.sqrt(s_**2 + e_**2 + zu**2)
el_s = np.degrees(np.arcsin(zu/rng))

obs = EarthLocation.from_geodetic(lon=LON*u.deg, lat=LAT*u.deg, height=0*u.m)
el_r = itrs.transform_to(AltAz(location=obs, obstime=tm)).alt.deg

imax = int(np.argmax(el_r))
sub_lat = np.degrees(np.arcsin(RZ/np.sqrt(RX**2+RY**2+RZ**2)))
sub_lon = np.degrees(np.arctan2(RY, RX))
dmin = np.argmin(np.hypot(np.abs(sub_lat-LAT), ((sub_lon-LON+540)%360)-180)*111.32)

out = {
  "我的两体重建": {"最大仰角_deg": round(float(el_r[imax]),3), "出现时刻_s": int(dt[imax]),
                "星下点最近处纬度": round(float(sub_lat[dmin]),3), "经度": round(float(sub_lon[dmin]),3),
                "距合肥_km": round(float(np.hypot(abs(sub_lat[dmin]-LAT), ((sub_lon[dmin]-LON+540)%360)-180)*111.32),1)},
  "报告口径": {"最大仰角_deg": 79.417071, "几何可见窗口数": 3, "可见总时长_s": 1296, "最短斜距_km": 607.32},
  "ECEF位置误差_km": {"min": round(float(err.min()),2), "mean": round(float(err.mean()),2), "max": round(float(err.max()),2)},
  "仰角误差_deg": {"全时段min": round(float((el_s-el_r).min()),3), "全时段max": round(float((el_s-el_r).max()),3)},
  "按报告斜距折算的角误差_deg": {"最短斜距607km": round(math.degrees(math.atan2(float(err.mean()), 607.3)),2),
                          "最长斜距1951km": round(math.degrees(math.atan2(float(err.mean()), 1950.9)),2)},
}
print("OK")
with open("E:/tmp/frame_err2.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
