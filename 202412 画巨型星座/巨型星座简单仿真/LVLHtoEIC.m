function state_XYZ = LVLHtoEIC(centerOE,state_rvn)
%% 由地心惯性系转换至LVLH系
%% 编写日期：2021/10/28
a = centerOE(1);e = centerOE(2);qji = centerOE(3);
OMG = centerOE(4);w = centerOE(5);f = centerOE(6);u = w+f;
Au = [cos(u) sin(u) 0;-1*sin(u) cos(u) 0;0 0 1];
Ai = [1 0 0;0 cos(qji) sin(qji);0 -1*sin(qji) cos(qji)];
AOMG = [cos(OMG) sin(OMG) 0;-1*sin(OMG) cos(OMG) 0;0 0 1];
A = Au*Ai*AOMG;%%mTran = Rz(u)Rx(i)Rz(OMG);
state_XYZ = A'*state_rvn;
end