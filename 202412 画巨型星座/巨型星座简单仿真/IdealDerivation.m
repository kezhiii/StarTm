function OEnext = IdealDerivation(OE,t)
%%在理想情况下轨道根数的递推
%%输入OE：当前轨道根数a,e,i,OMG,w,M(m,rad)，t：仿真步长
%%输出OEnext：下一时刻轨道根数a,e,i,OMG,w,M(m,rad)
a = OE(1);%m
e = OE(2);
ii = OE(3);%rad
OMG0 = OE(4);
omg0 = OE(5);
M0 = OE(6);

mu = 3.986004415e14; %地心引力常数（m^3/s^2）
n = sqrt(mu/a^3); %轨道角速度（rad/s）

dOMG = 0;%rad/s
domg = 0;
dM = n;

OMG = OMG0+dOMG*t;
omg = omg0+domg*t;
M = M0+dM*t;

OEnext = [a;e;ii;OMG;omg;M];
end