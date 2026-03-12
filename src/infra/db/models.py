from sqlalchemy import ForeignKey, String, Integer, Float, CheckConstraint
from sqlalchemy.orm import relationship, DeclarativeBase, mapped_column, Mapped

class Base(DeclarativeBase):
    pass

class Gender(Base):
    __tablename__ = 'genders'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

class MasterCategory(Base):
    __tablename__ = 'master_categories'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    subcategories: Mapped[list["SubCategory"]] = relationship("SubCategory", back_populates="master_category", cascade="all, delete-orphan")

class SubCategory(Base):
    __tablename__ = 'sub_categories'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    master_category_id: Mapped[int] = mapped_column(ForeignKey('master_categories.id'), nullable=False)
    master_category: Mapped["MasterCategory"] = relationship("MasterCategory", back_populates="subcategories")
    article_types: Mapped[list["ArticleType"]] = relationship("ArticleType", back_populates="sub_category", cascade="all, delete-orphan")

class ArticleType(Base):
    __tablename__ = 'article_types'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    sub_category_id: Mapped[int] = mapped_column(ForeignKey('sub_categories.id'), nullable=False)
    sub_category: Mapped["SubCategory"] = relationship("SubCategory", back_populates="article_types")

class Color(Base):
    __tablename__ = 'colors'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

class Brand(Base):
    __tablename__ = 'brands'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

class Season(Base):
    __tablename__ = 'seasons'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

class Product(Base):
    __tablename__ = 'products'
    __table_args__ = (
        CheckConstraint('price > 0', name='check_price_positive'),
        CheckConstraint('availability >= 0', name='check_availability_non_negative'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_display_name: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=True)
    usage: Mapped[str] = mapped_column(String, nullable=True)
    availability: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    
    gender_id: Mapped[int] = mapped_column(ForeignKey('genders.id'), nullable=False)
    gender: Mapped["Gender"] = relationship("Gender")

    master_category_id: Mapped[int] = mapped_column(ForeignKey('master_categories.id'), nullable=False)
    master_category: Mapped["MasterCategory"] = relationship("MasterCategory")

    sub_category_id: Mapped[int] = mapped_column(ForeignKey('sub_categories.id'), nullable=False)
    sub_category: Mapped["SubCategory"] = relationship("SubCategory")

    article_type_id: Mapped[int] = mapped_column(ForeignKey('article_types.id'), nullable=False)
    article_type: Mapped["ArticleType"] = relationship("ArticleType")

    brand_id: Mapped[int] = mapped_column(ForeignKey('brands.id'), nullable=False)
    brand: Mapped["Brand"] = relationship("Brand")

    season_id: Mapped[int] = mapped_column(ForeignKey('seasons.id'), nullable=False)
    season: Mapped["Season"] = relationship("Season")

    base_colour_id: Mapped[int] = mapped_column(ForeignKey('colors.id'), nullable=False)
    base_colour: Mapped["Color"] = relationship("Color", foreign_keys=[base_colour_id])

    colour1_id: Mapped[int | None] = mapped_column(ForeignKey('colors.id'), nullable=True)
    colour1: Mapped["Color"] = relationship("Color", foreign_keys=[colour1_id])

    colour2_id: Mapped[int | None] = mapped_column(ForeignKey('colors.id'), nullable=True)
    colour2: Mapped["Color"] = relationship("Color", foreign_keys=[colour2_id])

    image_top: Mapped[str | None] = mapped_column(String, nullable=True)
    image_back: Mapped[str | None] = mapped_column(String, nullable=True)
    image_search: Mapped[str | None] = mapped_column(String, nullable=True)
    image_default: Mapped[str | None] = mapped_column(String, nullable=True)
    image_left: Mapped[str | None] = mapped_column(String, nullable=True)
    image_front: Mapped[str | None] = mapped_column(String, nullable=True)
    image_right: Mapped[str | None] = mapped_column(String, nullable=True)
