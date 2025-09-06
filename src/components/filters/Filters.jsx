import wareHouseIcon from "../../assets/warehouse.png";
import BuildingIcon from "../../assets/building-tower.png";
import houseIcon from "../../assets/house.png";
import ImageIcon from "../React/ImageIcon";
import cabinIcon from "../../assets/cabin.png";
import landIcon from "../../assets/building.png";
// React Component
import ButtonModal from "../ui/ButtonModal";
import { useFilters } from "../filters/FilterContext";

export default function Filters() {
    const { filters, setFilters } = useFilters()

    console.log(filters)

    const handleSelect = (type)=>{
        setFilters({...filters, type});
    }

    return (
        <div className="w-full border-b bg-white border-gray-200 pt-4 fixed z-20 top-24 left-0">
            <div className="min-h-fit w-11/12 m-auto flex justify-between">
                <div className="h-16">
                    <div className="flex flex-row gap-2 md:gap-8 items-center h-full">
                        <ImageIcon type="Depa" activeType={filters.type} onClick={()=>handleSelect("Depa")}>
                            <img src={BuildingIcon.src} className="w-8" />
                            <span>Depa</span>
                        </ImageIcon>
                        <ImageIcon type="House" activeType={filters.type} onClick={()=>handleSelect("House")}>
                            <img src={houseIcon.src} className="w-8" />
                            <span>Casa</span>
                        </ImageIcon>
                        <ImageIcon type="Bodega" activeType={filters.type} onClick={()=>handleSelect("Bodega")}>
                            <img src={wareHouseIcon.src} className="w-8" />
                            <span>Bodega</span>
                        </ImageIcon>
                        <ImageIcon type="Cabaña" activeType={filters.type} onClick={()=>handleSelect("Cabaña")}>
                            <img src={cabinIcon.src} className="w-8" />
                            <span>Cabaña</span>
                        </ImageIcon>
                        <ImageIcon type="Terreno" activeType={filters.type} onClick={()=>handleSelect("Terreno")}>
                            <img src={landIcon.src} className="w-8" />
                            <span>Terreno</span>
                        </ImageIcon>
                    </div>
                </div>
                <div>
                    <ButtonModal>
                        <span className="hidden md:block">Filtros</span>
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="icon icon-tabler icons-tabler-outline icon-tabler-adjustments-horizontal"
                        ><path stroke="none" d="M0 0h24v24H0z" fill="none"
                        ></path><path
                            d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"
                        ></path><path d="M4 6l8 0"></path><path d="M16 6l4 0"
                        ></path><path
                            d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"
                        ></path><path d="M4 12l2 0"></path><path d="M10 12l10 0"
                        ></path><path
                            d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"
                        ></path><path d="M4 18l11 0"></path><path d="M19 18l1 0"
                        ></path></svg>
                    </ButtonModal>
                </div>
            </div>
        </div>
    )
}