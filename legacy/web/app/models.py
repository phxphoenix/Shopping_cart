from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str]

    orders: Mapped[list[Order]] = relationship(back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[str]
    subtotal: Mapped[float]
    delivery: Mapped[float]
    total: Mapped[float]
    payment_method: Mapped[str]

    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    customer: Mapped[Customer] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payment: Mapped[PaymentDetails] = relationship(back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    name: Mapped[str]
    category: Mapped[str]
    price: Mapped[float]
    qty: Mapped[int]

    order: Mapped[Order] = relationship(back_populates="items")


class PaymentDetails(Base):
    __tablename__ = "payment_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    method: Mapped[str]
    card_number: Mapped[str] = mapped_column(nullable=True)
    expiry: Mapped[str] = mapped_column(nullable=True)
    cvv: Mapped[str] = mapped_column(nullable=True)
    paypal_email: Mapped[str] = mapped_column(nullable=True)
    bitcoin_wallet: Mapped[str] = mapped_column(nullable=True)

    order: Mapped[Order] = relationship(back_populates="payment")
