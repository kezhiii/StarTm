close all;
clear all;
clc;

%% 常量
global mu mu_moon mu_sun RE wE J2 hours days deg
mu = 3.986004418e14; %地心引力常数(m^3/s^2)
mu_moon = 4.903e12; %月球引力常数(m^3/s^2)
mu_sun = 1.32712440018e20; %太阳引力常数(m^3/s^2)
RE = 6.378137e6; %地球半径(m)
J2 = 1.082626683e-3; %J2摄动参数
wE = [0 0 7.2921159e-5]';
hours = 3600; %小时转秒
days = 24*hours; %天转秒
deg = pi/180; %度转弧度
%% 儒略日
global JD0
Year = 2021;Month = 8;Day = 17;
JD0 = Day-32075+1461*(Year+4800+(Month-14)/12)/4+367*(Month-2-(Month-14)/12*12)/12-3*((Year+4900+(Month-14)/12)/100)/4;
%% 输入星座参数
H = 508e3; %轨道高度
inclination = 55*deg;
F = 0;
Pnum = 60;
Snum = 60;
Nnum = Pnum*Snum;
%% 随机生成星座轨道数据
sateOEmat = zeros(Nnum,6);
sateOETra = sateOEmat;
for num = 1:Nnum
    S = rem(num,Snum);
    if S==0
        S = Snum;
    end
    P = (num-S)/Snum;
    sateOEmat(num,:) = [RE+H+0*(rand-0.5)*2 0.01*rand inclination+0.01*deg*(rand-0.5)*2 2*pi/Pnum*P+0.01*deg*(rand-0.5)*2 0.1*deg*(rand-0.5)*2 2*pi/Snum*S+2*pi*F*P/Snum/Pnum+0.1*deg*(rand-0.5)*2];
    sateOETra(num,:) = OrbitElementsToInertiastate(sateOEmat(num,:));
end
%% 轨道计算
ts = 10;
Nstep = 1000;
for step = 1:Nstep
    for num = 1:Nnum
        sateOE = sateOEmat(num,:);
        sateOE(6) = f_To_M(sateOE(2),sateOE(6)); %f转M
        %         sateOE(:) = IdealDerivation(sateOE(:),ts);
        %         sateOE(:) = J2derivation(sateOE(:),ts);
        sateOE(:) = PerturbedOrbit(sateOE(:),ts,step);
        sateOE(6) = M_To_f(sateOE(2),sateOE(6)); %M转f
        sateOEmat(num,:) = sateOE;
        sateOETra(num,:) = OrbitElementsToInertiastate(sateOEmat(num,:));
    end
end
%% 画图
figure(1);
hold on;
for num = 1:Nnum
    plot3(sateOETra(num,1),sateOETra(num,2),sateOETra(num,3),'b*');
end
axis equal;
xlabel('x (m)');
ylabel('y (m)');
zlabel('z (m)');
