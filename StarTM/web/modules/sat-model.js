// 卫星模型：1400×1200×600 mm 箱体 + ±Y 双太阳翼 + −Z 对地发光面（方案 4.1）
// 尺寸为 third-person 场景单位（地球半径 50），与原 0.5 半径球体观感相当
import * as THREE from 'three';

export function buildSatelliteMesh(bodyMaterial) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.86, 0.43), bodyMaterial);
    group.add(body);

    const wingGeo = new THREE.BoxGeometry(0.05, 1.4, 0.55);
    const wingMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, emissive: 0x061020 });
    const wingTop = new THREE.Mesh(wingGeo, wingMat);
    wingTop.position.y = 1.12;
    group.add(wingTop);
    const wingBottom = new THREE.Mesh(wingGeo, wingMat);
    wingBottom.position.y = -1.12;
    group.add(wingBottom);

    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, side: THREE.DoubleSide });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.72), faceMat);
    face.position.z = -0.22;
    face.rotation.y = Math.PI;
    group.add(face);

    return group;
}
