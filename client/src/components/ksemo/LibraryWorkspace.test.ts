import { describe, expect, it } from "vitest";
import {
  filterLibraryWorkspaceItems,
  selectVisibleLibraryItems,
} from "./LibraryWorkspace";

const files = [
  {
    id: "file-image",
    filename: "Sketch.png",
    mimeType: "image/png",
    sizeBytes: 1200,
    url: "/sketch",
  },
  {
    id: "file-doc",
    filename: "Brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2200,
    url: "/brief",
  },
];

describe("KSEMO dedicated Library workspace filters", () => {
  it("filters private items by search text and All, Images, and Files views", () => {
    expect(filterLibraryWorkspaceItems(files, "", "all")).toHaveLength(2);
    expect(
      filterLibraryWorkspaceItems(files, "", "images").map(file => file.id)
    ).toEqual(["file-image"]);
    expect(
      filterLibraryWorkspaceItems(files, "", "files").map(file => file.id)
    ).toEqual(["file-doc"]);
    expect(
      filterLibraryWorkspaceItems(files, "brief", "all").map(file => file.id)
    ).toEqual(["file-doc"]);
  });

  it("adds all currently visible files without clearing an existing selection", () => {
    expect(
      Array.from(
        selectVisibleLibraryItems(new Set(["already-selected"]), files)
      )
    ).toEqual(["already-selected", "file-image", "file-doc"]);
  });
});
