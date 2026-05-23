from pydantic import BaseModel, Field
from typing import Optional


class PhoneSummary(BaseModel):
    """Minimal phone info from a listing page."""
    model_config = {"extra": "allow"}

    product_id: int
    name: str
    detail_url: str = ""
    spec_url: str = ""
    image_url: Optional[str] = None
    price: Optional[str] = None
    release_date: Optional[str] = None


class PhoneSpecs(BaseModel):
    """Full phone specifications parsed from param.shtml."""
    product_id: int
    name: str = ""
    detail_url: str = ""

    basic: dict[str, str] = Field(default_factory=dict, description="基本参数")
    dimensions: dict[str, str] = Field(default_factory=dict, description="外形")
    hardware: dict[str, str] = Field(default_factory=dict, description="硬件")
    display: dict[str, str] = Field(default_factory=dict, description="屏幕")
    camera: dict[str, str] = Field(default_factory=dict, description="摄像头")
    connectivity: dict[str, str] = Field(default_factory=dict, description="网络与连接")
    battery: dict[str, str] = Field(default_factory=dict, description="电池与续航")
    features: dict[str, str] = Field(default_factory=dict, description="功能与服务")
    accessories: dict[str, str] = Field(default_factory=dict, description="手机附件")

    @property
    def all_specs(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for cat in (
            self.basic,
            self.dimensions,
            self.hardware,
            self.display,
            self.camera,
            self.connectivity,
            self.battery,
            self.features,
            self.accessories,
        ):
            result.update(cat)
        return result


class FilterCriterion(BaseModel):
    """A single filter condition parsed from natural language."""
    field: str
    op: str = "eq"
    value: str
