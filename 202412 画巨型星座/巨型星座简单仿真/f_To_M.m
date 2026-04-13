function M=f_To_M(e,f)
%%将真近点角f转换为平近点角M,2014.1.8   由WZK的C语言程序改造
%%单位：rad
format long
E=2*atan(sqrt((1-e)/(1+e))*tan(f/2));
M=E-e*sin(E);
end