"""Add constellation tables: satellites and satellite_neighbors.

Revision ID: 002_constellation
Revises: 001_initial
Create Date: 2026-04-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_constellation'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'satellites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sat_id', sa.Integer(), nullable=False),
        sa.Column('semi_major_axis', sa.Float(), nullable=False),
        sa.Column('eccentricity', sa.Float(), nullable=False),
        sa.Column('inclination', sa.Float(), nullable=False),
        sa.Column('raan', sa.Float(), nullable=False),
        sa.Column('argument_of_perigee', sa.Float(), nullable=False),
        sa.Column('true_anomaly', sa.Float(), nullable=False),
        sa.Column('mass', sa.Float(), nullable=False, server_default='300.0'),
        sa.Column('cross_section', sa.Float(), nullable=False, server_default='0.785'),
        sa.Column('drag_coefficient', sa.Float(), nullable=False, server_default='2.2'),
        sa.Column('plane_index', sa.Integer(), nullable=False),
        sa.Column('slot_index', sa.Integer(), nullable=False),
        sa.Column('light_state', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sat_id'),
    )
    op.create_index(op.f('ix_satellites_sat_id'), 'satellites', ['sat_id'], unique=True)

    op.create_table(
        'satellite_neighbors',
        sa.Column('sat_id', sa.Integer(), nullable=False),
        sa.Column('neighbor_id', sa.Integer(), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['neighbor_id'], ['satellites.sat_id'], ),
        sa.ForeignKeyConstraint(['sat_id'], ['satellites.sat_id'], ),
        sa.PrimaryKeyConstraint('sat_id', 'neighbor_id'),
    )


def downgrade() -> None:
    op.drop_table('satellite_neighbors')
    op.drop_index(op.f('ix_satellites_sat_id'), table_name='satellites')
    op.drop_table('satellites')
