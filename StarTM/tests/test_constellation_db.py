"""Test Phase 5 constellation DB integration"""
import pytest
import pytest_asyncio
from datetime import datetime
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from server.db.models import Satellite, SatelliteNeighbor
from server.db.repositories.satellite_repo import SatelliteRepository
from server.db.repositories.neighbor_repo import NeighborRepository


@pytest_asyncio.fixture
async def db_session():
    """Create SQLite in-memory DB session"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_factory() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


class TestSatelliteRepository:
    """Satellite repository tests"""

    @pytest.mark.asyncio
    async def test_create_and_get(self, db_session):
        """Test creating and retrieving a satellite"""
        repo = SatelliteRepository(db_session)
        
        sat = Satellite(
            sat_id=0,
            semi_major_axis=6778137.0,
            eccentricity=0.001,
            inclination=0.9599,
            raan=1.2345,
            argument_of_perigee=0.5,
            true_anomaly=0.1,
            mass=300.0,
            cross_section=0.785,
            drag_coefficient=2.2,
            plane_index=0,
            slot_index=0,
            light_state=False,
        )
        created = await repo.create(sat)
        assert created.id is not None
        assert created.sat_id == 0
        
        fetched = await repo.get_by_id(0)
        assert fetched is not None
        assert fetched.semi_major_axis == 6778137.0

    @pytest.mark.asyncio
    async def test_create_many(self, db_session):
        """Test batch creating satellites"""
        repo = SatelliteRepository(db_session)
        
        satellites = [
            Satellite(
                sat_id=i,
                semi_major_axis=6778137.0 + i * 1000,
                eccentricity=0.001,
                inclination=0.9599,
                raan=1.2345,
                argument_of_perigee=0.5,
                true_anomaly=0.1,
                mass=300.0,
                cross_section=0.785,
                drag_coefficient=2.2,
                plane_index=i // 5,
                slot_index=i % 5,
                light_state=False,
            )
            for i in range(10)
        ]
        count = await repo.create_many(satellites)
        assert count == 10
        
        all_sats = await repo.get_all()
        assert len(all_sats) == 10

    @pytest.mark.asyncio
    async def test_update_light_state(self, db_session):
        """Test updating light state"""
        repo = SatelliteRepository(db_session)
        
        sat = Satellite(
            sat_id=0,
            semi_major_axis=6778137.0,
            eccentricity=0.001,
            inclination=0.9599,
            raan=1.2345,
            argument_of_perigee=0.5,
            true_anomaly=0.1,
            mass=300.0,
            cross_section=0.785,
            drag_coefficient=2.2,
            plane_index=0,
            slot_index=0,
            light_state=False,
        )
        await repo.create(sat)
        
        success = await repo.update_light_state(0, True)
        assert success is True
        
        fetched = await repo.get_by_id(0)
        assert fetched.light_state is True

    @pytest.mark.asyncio
    async def test_get_by_plane(self, db_session):
        """Test querying by plane index"""
        repo = SatelliteRepository(db_session)
        
        satellites = [
            Satellite(
                sat_id=i,
                semi_major_axis=6778137.0,
                eccentricity=0.001,
                inclination=0.9599,
                raan=1.2345,
                argument_of_perigee=0.5,
                true_anomaly=0.1,
                mass=300.0,
                cross_section=0.785,
                drag_coefficient=2.2,
                plane_index=0 if i < 5 else 1,
                slot_index=i,
                light_state=False,
            )
            for i in range(10)
        ]
        await repo.create_many(satellites)
        
        plane_0 = await repo.get_by_plane(0)
        assert len(plane_0) == 5
        
        plane_1 = await repo.get_by_plane(1)
        assert len(plane_1) == 5

    @pytest.mark.asyncio
    async def test_get_all_as_dict(self, db_session):
        """Test loading all satellites as dict"""
        repo = SatelliteRepository(db_session)
        
        sat = Satellite(
            sat_id=0,
            semi_major_axis=6778137.0,
            eccentricity=0.001,
            inclination=0.9599,
            raan=1.2345,
            argument_of_perigee=0.5,
            true_anomaly=0.1,
            mass=300.0,
            cross_section=0.785,
            drag_coefficient=2.2,
            plane_index=0,
            slot_index=0,
            light_state=True,
        )
        await repo.create(sat)
        
        result = await repo.get_all_as_dict()
        assert 0 in result
        assert result[0]["orbit_elements"][0] == 6778137.0
        assert result[0]["physical_props"]["mass"] == 300.0
        assert result[0]["light_state"] is True


class TestNeighborRepository:
    """Neighbor repository tests"""

    @pytest.mark.asyncio
    async def test_upsert_and_get(self, db_session):
        """Test adding and retrieving neighbor relations"""
        sat_repo = SatelliteRepository(db_session)
        neighbor_repo = NeighborRepository(db_session)
        
        # Create satellites first
        sats = [
            Satellite(
                sat_id=i,
                semi_major_axis=6778137.0,
                eccentricity=0.001,
                inclination=0.9599,
                raan=1.2345,
                argument_of_perigee=0.5,
                true_anomaly=0.1,
                mass=300.0,
                cross_section=0.785,
                drag_coefficient=2.2,
                plane_index=0,
                slot_index=i,
                light_state=False,
            )
            for i in range(5)
        ]
        await sat_repo.create_many(sats)
        
        # Add neighbor relations
        n1 = await neighbor_repo.upsert_neighbor(0, 1, 100.0)
        assert n1.sat_id == 0
        assert n1.neighbor_id == 1
        assert n1.distance_km == 100.0
        
        # Get neighbors
        neighbors = await neighbor_repo.get_neighbors(0)
        assert len(neighbors) == 1
        assert neighbors[0].neighbor_id == 1

    @pytest.mark.asyncio
    async def test_upsert_many(self, db_session):
        """Test batch upserting neighbor relations"""
        sat_repo = SatelliteRepository(db_session)
        neighbor_repo = NeighborRepository(db_session)
        
        sats = [
            Satellite(
                sat_id=i,
                semi_major_axis=6778137.0,
                eccentricity=0.001,
                inclination=0.9599,
                raan=1.2345,
                argument_of_perigee=0.5,
                true_anomaly=0.1,
                mass=300.0,
                cross_section=0.785,
                drag_coefficient=2.2,
                plane_index=0,
                slot_index=i,
                light_state=False,
            )
            for i in range(5)
        ]
        await sat_repo.create_many(sats)
        
        neighbor_map = {
            0: [1, 2],
            1: [0, 3],
            2: [0, 4],
        }
        count = await neighbor_repo.upsert_many(neighbor_map)
        assert count == 6  # 0→1, 0→2, 1→0, 1→3, 2→0, 2→4
        
        all_map = await neighbor_repo.get_all_neighbor_map()
        assert 0 in all_map
        assert set(all_map[0]) == {1, 2}
        assert set(all_map[1]) == {0, 3}

    @pytest.mark.asyncio
    async def test_delete_all(self, db_session):
        """Test deleting all neighbor relations"""
        sat_repo = SatelliteRepository(db_session)
        neighbor_repo = NeighborRepository(db_session)
        
        sats = [
            Satellite(
                sat_id=i,
                semi_major_axis=6778137.0,
                eccentricity=0.001,
                inclination=0.9599,
                raan=1.2345,
                argument_of_perigee=0.5,
                true_anomaly=0.1,
                mass=300.0,
                cross_section=0.785,
                drag_coefficient=2.2,
                plane_index=0,
                slot_index=i,
                light_state=False,
            )
            for i in range(3)
        ]
        await sat_repo.create_many(sats)
        
        await neighbor_repo.upsert_neighbor(0, 1, 100.0)
        await neighbor_repo.upsert_neighbor(1, 2, 200.0)
        
        deleted = await neighbor_repo.delete_all()
        assert deleted == 2
        
        all_map = await neighbor_repo.get_all_neighbor_map()
        assert len(all_map) == 0
