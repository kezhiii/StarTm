function r_sun = solar_position(JD)
%% This function calculates the geocentric equatorial position vector
%% of the sun, given the Julian date.
%% User M-functions required: None
%% ------------------------------------------------------------
%...Astronomical unit (m)
AU = 149597870.691e3;

%...Julian days since J2000
n = JD-2451545;

%...Julian centuries since J2000
cy = n/36525;

%...Mean anomaly (deg)
M = 357.528+0.9856003*n;
M = mod(M,360);

%...Mean longitude (deg)
L = 280.460+0.98564736*n;
L = mod(L,360);

%...Apparent ecliptic longitude (deg)
lamda = L+1.915*sind(M)+0.020*sind(2*M);
lamda = mod(lamda,360);

%...Obliquity of the ecliptic (deg)
eps = 23.439-0.0000004*n;

%...Unit vector from earth to sun
u = [cosd(lamda) sind(lamda)*cosd(eps) sind(lamda)*sind(eps)];

%...Distance from earth to sun (km)
rS = (1.00014-0.01671*cosd(M)-0.000140*cosd(2*M))*AU;

%...Geocentric position vector (km)
r_sun = rS*u;

end