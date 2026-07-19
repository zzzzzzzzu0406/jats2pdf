import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { ElsevierPage } from "./ElsevierPage";
import { IEEEPage } from "./IEEEPage";
import { SpringerPage } from "./SpringerPage";
import { NaturePage } from "./NaturePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: ElsevierPage },
      { path: "ieee", Component: IEEEPage },
      { path: "springer", Component: SpringerPage },
      { path: "nature", Component: NaturePage },
    ],
  },
]);
