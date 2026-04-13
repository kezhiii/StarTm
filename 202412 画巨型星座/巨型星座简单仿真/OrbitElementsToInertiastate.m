function InertiaState = OrbitElementsToInertiastate(OrbitElements)
%%OrbitElements：输入量，轨道根数：a,e,qji,OMG,omg,f  （m,rad）
%%InertiaState:输出量，惯性坐标位置和速度x,y,z,vx,vy,vz
%%2014.1.7,把轨道根数转换为惯性坐标系下的状态。
format long
MU = 3.986004415e14;      %%地球引力场数（m^3/s^2)
a = OrbitElements(1);
e = OrbitElements(2);
qji = OrbitElements(3);
OMG = OrbitElements(4);
omg = OrbitElements(5);
f = OrbitElements(6);
%%将f的范围调整到[0,2*pi]
while f > 2*pi
    f = f-2*pi;
end
while f < 0
    f = f+2*pi;
end
%%%%

%%方程参考《航天器轨道动力学与控制》上册55页，由WZK的C语言程序改造。
% q1 = e * cos(omg);
% q2 = e * sin(omg);
% u = omg + f;
% r = a * (1 - q1^2  - q2^2) / (1 + q1 * cos(u) + q2 * sin(u));
% V = sqrt(MU * (2/r - 1/a));
% STX = r * (cos(OMG) * cos(u) - sin(OMG) * sin(u) * cos(qji));
% STY = r * (sin(OMG) * cos(u) + cos(OMG) * sin(u) * cos(qji));
% STZ = r * sin(u) * sin(qji);
% sinSS = sqrt(MU * a * (1 - q1^2  - q2^2)) / (r * V);
% %%防止计算误差，防不胜防！！
% if (sinSS>1.0)
%     sinSS = 1.0;
% elseif (sinSS<-1.0)
%     sinSS = -1.0;
% end
% %%%%%
% if (f >= 0 && f <= pi)
%         SS = asin(sinSS);
% else
%         SS = pi - asin(sinSS);
% end
% UU = u + SS;
% STVx = V * (cos(OMG) * cos(UU) - sin(OMG) * sin(UU) * cos(qji));
% STVy = V * (cos(UU) * sin(OMG) + cos(OMG) * sin(UU) * cos(qji));
% STVz = V * sin(UU)* sin(qji);
% %%输出结果
% InertiaState = [STX STY STZ STVx STVy STVz]';

%%参考XJH提供的书“航天器轨道力学”部分，第41——43页
p = a*(1-e^2);
r = p/(1+e*cos(f));
R = [r*cos(f) r*sin(f) 0]';
V = (MU/p)^0.5*[-1*sin(f) (e+cos(f)) 0]';
Aw = [cos(omg) sin(omg) 0;-1*sin(omg) cos(omg) 0;0 0 1];
Ai = [1 0 0;0 cos(qji) sin(qji);0 -1*sin(qji) cos(qji)];
AOm = [cos(OMG) sin(OMG) 0;-1*sin(OMG) cos(OMG) 0;0 0 1];
A = Aw*Ai*AOm;
R = A'*R;
V = A'*V;
InertiaState = [R;V];

end