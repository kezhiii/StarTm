function OEnext = PerturbedOrbit(OE,ts,step)
%% 考虑J2摄动，大气阻力摄动，日月引力摄动
%% 注意！！OE=[a;e;i;OMG;omg;M！！！]
%% 编写日期：2021/09/26
global JD0 mu mu_moon mu_sun J2 RE wE
JD = JD0+ts*(step-1);
%% ---------------------------参数初始化---------------------------
a = OE(1);e = OE(2);i = OE(3);
OMG = OE(4);w = OE(5);M = OE(6);
f = M_To_f(e,M);
phi = w+f; %纬度幅角
n = sqrt(mu/a^3); %角速度
p = a*(1-e^2); %半通径
Inertialstate = OrbitElementsToInertiastate(OE);
R = Inertialstate(1:3)';V = Inertialstate(4:6)';
r = norm(R);ur = R/r; %径向单位矢量
H = cross(R,V);uh = H/norm(H); %法向单位矢量
s = cross(uh,ur);us = s/norm(s); %迹向单位矢量
%% -----------------------计算轨道根数变化率------------------------
% ...J2摄动
adot_J2 =0;
edot_J2 = 0;
idot_J2 = 0;
OMGdot_J2 = -1.5*n*J2*(RE/a)^2*(1-e^2)^(-2)*cos(i);
wdot_J2 = 1.5*n*J2*RE^2*a^(-2)*(1-e^2)^(-2)*(2-2.5*(sin(i))^2);
Mdot_J2 = 1.5*n*J2*RE^2*a^(-2)*(1-e^2)^(-1.5)*(1-1.5*(sin(i))^2);
% ...大气阻力摄动
CD = 2.2; %阻力系数
m = 300; %质量(kg)
A = pi/4*(1^2); %横截面积(m^2)
alt = (r-RE)/1000; %海拔高度(km)
rho = atmosphere(alt); %大气密度(kg/m^3)
Vrel = V-cross(wE,R); %相对于大气的速度矢量(m/s)
vrel = norm(Vrel); %相对于大气的速度大小(m/s)
uv = Vrel/vrel; %相对速度单位矢量
% ap_drag = -CD*A/m*rho*vrel^2/2*uv; %大气阻力摄动加速度(m/s^2)
ap_drag = -0.01*rho*vrel^2/2*uv; %大气阻力摄动加速度(m/s^2)
apr_drag = dot(ap_drag,ur); %LVLH坐标系下的大气阻力摄动分量
aps_drag = dot(ap_drag,us);
aph_drag = dot(ap_drag,uh);
% ...太阳引力摄动
R_S = solar_position(JD); %确定太阳的标称位置矢量
r_S = norm(R_S);
R_rel = R_S-R; %确定地心惯性系下太阳相对位置矢量
r_rel = norm(R_rel);
q = dot(R,(2*R_S-R)/r_S^2); %详见Appendix F
F = (q^2-3*q+3)*q/(1+(1-q)^1.5);
ap_sun = mu_sun/r_rel^3*(F*R_S-R); %太阳引力摄动加速度
apr_sun = dot(ap_sun,ur); %LVLH坐标系下的太阳引力摄动分量
aps_sun = dot(ap_sun,us);
aph_sun = dot(ap_sun,uh);
% ...月球引力摄动
R_m = lunar_position(JD); %确定月球的标称位置矢量
r_m = norm(R_m);
R_rel = R_m-R; %确定地心惯性系下月球相对位置矢量
r_rel = norm(R_rel);
q = dot(R,(2*R_m-R)/r_m^2); %详见Appendix F
F = (q^2-3*q+3)*q/(1+(1-q)^1.5);
ap_moon = mu_moon/r_rel^3*(F*R_m-R); %月球引力摄动加速度
apr_moon = dot(ap_moon,ur); %LVLH坐标系下的月球引力摄动分量
aps_moon = dot(ap_moon,us);
aph_moon = dot(ap_moon,uh);
% ...摄动加速度汇总
% apr_ms = apr_drag+apr_sun+apr_moon;
% aps_ms = aps_drag+aps_sun+aps_moon;
% aph_ms = aph_drag+aph_sun+aph_moon;
apr_ms = apr_drag;
aps_ms = aps_drag;
aph_ms = aph_drag;
% apr_ms = 0;
% aps_ms = 0;
% aph_ms = 0;
% ...高斯变分方程
if e~=0
    adot = adot_J2+2/n/sqrt(1-e^2)*(apr_ms*e*sin(f)+aps_ms*(1+e*cos(f)));
    edot = edot_J2+sqrt(1-e^2)/n/a*(apr_ms*sin(f)+aps_ms*(cos(f)+(e+cos(f))/(1+e*cos(f))));
    idot = idot_J2+r*cos(phi)/n/a^2/sqrt(1-e^2)*aph_ms;
    OMGdot = OMGdot_J2+r*sin(phi)/n/a^2/sqrt(1-e^2)/sin(i)*aph_ms;
    wdot = wdot_J2+sqrt(1-e^2)/n/a/e*(-apr_ms*cos(f)+aps_ms*(1+r/p)*sin(f))-cos(i)*OMGdot;
    Mdot = n+Mdot_J2-(1-e^2)/n/a/e*(-apr_ms*(cos(f)-2*e*r/p)+aps_ms*(1+r/p)*sin(f));
else
    adot = adot_J2+2/n*aps_ms;
    edot = edot_J2+1/n/a*(apr_ms*sin(f)+2*aps_ms*cos(f));
    idot = idot_J2+cos(phi)/n/a*aph_ms;
    OMGdot = OMGdot_J2+sin(phi)/n/a/sin(i)*aph_ms;
    wdot = 0;
    Mdot = n+wdot_J2+Mdot_J2-2/n/a*apr_ms-sin(phi)*cos(i)/n/a/sin(i)*aph_ms;
end
%% ----------------------------更新轨道根数------------------------
anext = a+adot*ts;
enext = e+edot*ts;
inext = i+idot*ts;
OMGnext = OMG+OMGdot*ts;
wnext = w+wdot*ts;
Mnext = M+Mdot*ts;
OEnext = [anext;enext;inext;OMGnext;wnext;Mnext];
end