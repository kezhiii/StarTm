# 混合投影方案实施计划

## 问题

当卫星仰角接近90°（天顶方向）时，`computeHillToGroundMatrix` 和 `computeHillToGroundRotation` 中的 `upLen` 趋近于0，导致：
1. 视线平面坐标系退化
2. M⁻¹ 投影矩阵无法计算
3. 编队图案出现严重透视畸变

## 解决方案

采用**混合投影**：当 `upLen` 过小时，使用 S 轴（沿轨方向）作为参考定义视线平面，并通过加权混合实现平滑过渡。

## 修改文件

- `web/modules/math-utils.js`

## 备份位置

- `backups/math-utils_20260626_155612/math-utils.js.bak`
