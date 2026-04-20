"""Initial migration: create configurations and protocol_logs tables.

Revision ID: 001_initial
Revises: 
Create Date: 2026-04-20 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'configurations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=128), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('section', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=256), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )
    op.create_index(op.f('ix_configurations_key'), 'configurations', ['key'], unique=False)
    op.create_index(op.f('ix_configurations_section'), 'configurations', ['section'], unique=False)

    op.create_table(
        'protocol_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('client_addr', sa.String(length=64), nullable=False),
        sa.Column('log_type', sa.String(length=32), nullable=False),
        sa.Column('frame_data', sa.Text(), nullable=True),
        sa.Column('frame_details', sa.JSON(), nullable=True),
        sa.Column('messages', sa.JSON(), nullable=True),
        sa.Column('crc_value', sa.Integer(), nullable=True),
        sa.Column('crc_passed', sa.Boolean(), nullable=True),
        sa.Column('result_success', sa.Boolean(), nullable=True),
        sa.Column('result_details', sa.JSON(), nullable=True),
        sa.Column('session_id', sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_protocol_logs_client_addr'), 'protocol_logs', ['client_addr'], unique=False)
    op.create_index(op.f('ix_protocol_logs_log_type'), 'protocol_logs', ['log_type'], unique=False)
    op.create_index(op.f('ix_protocol_logs_session_id'), 'protocol_logs', ['session_id'], unique=False)
    op.create_index(op.f('ix_protocol_logs_timestamp'), 'protocol_logs', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_protocol_logs_timestamp'), table_name='protocol_logs')
    op.drop_index(op.f('ix_protocol_logs_session_id'), table_name='protocol_logs')
    op.drop_index(op.f('ix_protocol_logs_log_type'), table_name='protocol_logs')
    op.drop_index(op.f('ix_protocol_logs_client_addr'), table_name='protocol_logs')
    op.drop_table('protocol_logs')
    op.drop_index(op.f('ix_configurations_section'), table_name='configurations')
    op.drop_index(op.f('ix_configurations_key'), table_name='configurations')
    op.drop_table('configurations')
