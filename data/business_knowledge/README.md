# Business Knowledge Folder

Place the store knowledge documents for `business_qa` in this folder.

Default configuration:
- Directory: `data/business_knowledge`
- Loaded files: `*.knowledge.md`
- FAISS index output: `data/business_knowledge_index`

- Keep one or more small Markdown files with information such as shipping, returns, payment methods, opening hours, store policies, contact channels, and promotions.
- Use clear headings and short paragraphs. The RAG service chunks this content automatically.

Example file:
- `store_info.knowledge.md`

If you want to load other formats later, update:
- `BUSINESS_KNOWLEDGE_GLOB`
