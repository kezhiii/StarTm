function f=M_To_f(ee,M)
%%将平近点角M转换为真近点角f,2014.1.8   由WZK的C语言程序改造
%%一种有效且收敛较快的方法 Murray C D,Dermott S F.Solar System Dynamics.Cambridge University Press,1999,Chap.2.
%%单位：rad

format long
kk=M/(2*pi);
M = M-floor(kk)*2*pi;%角度变换为[0，2*pi)

E = M+0.85*ee*sign(sin(M));
y = E-ee*sin(E)-M;
% while abs(y)>=eps
%     y = E-e*sin(E)-M;
% 	dy = 1.0-e*cos(E);
% 	E = E - y/dy;
% end
while abs(y)>=1.0e-15
    yita1 = E-ee*sin(E)-M;
    yita2 = 1-ee*cos(E);
    yita3 = ee*sin(E);
    yita4 = ee*cos(E);
    deta1 = -1*yita1/yita2;
    deta2 = -1*yita1/(yita2+0.5*deta1*yita3);
    deta3 = -1*yita1/(yita2+0.5*deta2*yita3+deta2^2*yita4/6);
    E = E+deta3;
    y = E-ee*sin(E)-M;
end
f = 2*atan(sqrt((1+ee)/(1-ee))*tan(E/2));
end