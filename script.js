// Configuration for default medications to fetch
const defaultMedications = [
    // Cardiovascular
    { cid: 5362119, category: "Cardiovascular" }, // Lisinopril
    { cid: 60823, category: "Cardiovascular" },   // Atorvastatin
    { cid: 4171, category: "Cardiovascular" },    // Metoprolol
    { cid: 2162, category: "Cardiovascular" },    // Amlodipine
    { cid: 3961, category: "Cardiovascular" },    // Losartan

    // Neurological
    { cid: 3446, category: "Neurological" },      // Gabapentin
    { cid: 6047, category: "Neurological" },      // Levodopa
    { cid: 63054, category: "Neurological" },     // Sertraline
    { cid: 3152, category: "Neurological" },      // Donepezil
    { cid: 5486971, category: "Neurological" },   // Pregabalin
    { cid: 3386, category: "Neurological" },      // Fluoxetine
    { cid: 3033, category: "Neurological" },      // Carbamazepine
    { cid: 2771, category: "Neurological" },      // Citalopram
    { cid: 5533, category: "Neurological" },      // Trazodone
    { cid: 2118, category: "Neurological" },      // Amitriptyline
    { cid: 4917, category: "Neurological" },      // Prochlorperazine
    { cid: 3821, category: "Neurological" },      // Ketamine
    { cid: 5284627, category: "Neurological" },   // Memantine
    { cid: 4158, category: "Neurological" },      // Methylphenidate
    { cid: 5732, category: "Neurological" },      // Valproic Acid
    { cid: 5284583, category: "Neurological" },   // Levetiracetam (Keppra)
    { cid: 2789, category: "Neurological" },      // Clobazam (Onfi)
    { cid: 3878, category: "Neurological" }       // Lamotrigine (Lamictal)
];

let currentMedications = [];
const grid = document.getElementById('medicationGrid');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Helper Functions
async function fetchMedicationDetails(cid, category = "Unknown") {
    try {
        // Fetch Properties - Extended List
        const propsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,Title,IUPACName,CanonicalSMILES,InChIKey,XLogP,TPSA,Complexity,Charge,HBondDonorCount,HBondAcceptorCount/JSON`;
        const propsRes = await fetch(propsUrl);
        const propsData = await propsRes.json();

        if (!propsData.PropertyTable) return null;

        const props = propsData.PropertyTable.Properties[0];

        // Fetch Description & Pharmacology
        const viewUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Pharmacology+and+Biochemistry`;
        let description = "No description available.";
        let mechanism = "Mechanism of action not available.";

        try {
            const viewRes = await fetch(viewUrl);
            const viewData = await viewRes.json();

            if (viewData.Record && viewData.Record.Section) {
                // Try to find Mechanism of Action
                const pharmaSection = viewData.Record.Section.find(s => s.TOCHeading === "Pharmacology and Biochemistry");
                if (pharmaSection && pharmaSection.Section) {
                    const moaSection = pharmaSection.Section.find(s => s.TOCHeading === "Mechanism of Action");
                    if (moaSection && moaSection.Information) {
                        mechanism = moaSection.Information[0].Value.StringWithMarkup[0].String;
                    }
                }
            }

            // Fallback description fetch if needed, or use what we have
            const descUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`;
            const descRes = await fetch(descUrl);
            const descData = await descRes.json();
            if (descData.InformationList && descData.InformationList.Information) {
                const info = descData.InformationList.Information;
                const bestDesc = info.find(i => i.Description && i.DescriptionSourceName === "ChEBI") ||
                    info.find(i => i.Description);
                if (bestDesc) description = bestDesc.Description;
            }

        } catch (e) {
            console.warn("Error fetching pharmacology:", e);
        }

        // Fetch Brand Names (Synonyms)
        let brandName = null;
        try {
            const synonymsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`;
            const synonymsRes = await fetch(synonymsUrl);
            const synonymsData = await synonymsRes.json();

            if (synonymsData.InformationList && synonymsData.InformationList.Information) {
                const synonyms = synonymsData.InformationList.Information[0].Synonym;
                // Common brand names to look for (case-insensitive)
                const knownBrands = ['Keppra', 'Onfi', 'Lamictal', 'Topamax', 'Lipitor', 'Zestril', 'Prinivil',
                    'Lopressor', 'Norvasc', 'Cozaar', 'Neurontin', 'Sinemet', 'Zoloft',
                    'Aricept', 'Lyrica', 'Prozac', 'Tegretol', 'Celexa', 'Desyrel',
                    'Elavil', 'Compazine', 'Ketalar', 'Namenda', 'Ritalin', 'Depakote'];

                // Find the first matching brand name
                brandName = synonyms.find(syn =>
                    knownBrands.some(brand => syn.toLowerCase() === brand.toLowerCase())
                );
            }
        } catch (e) {
            console.warn("Error fetching brand names:", e);
        }

        return {
            cid: cid,
            name: props.Title,
            brandName: brandName, // Add brand name
            category: category,
            formula: props.MolecularFormula,
            weight: `${props.MolecularWeight} g/mol`,
            description: description,
            mechanism: mechanism,
            // Extended Properties
            iupac: props.IUPACName || "N/A",
            smiles: props.CanonicalSMILES || "N/A",
            inchikey: props.InChIKey || "N/A",
            xlogp: props.XLogP || "N/A",
            tpsa: props.TPSA || "N/A",
            complexity: props.Complexity || "N/A",
            charge: props.Charge || "N/A",
            hbondDonors: props.HBondDonorCount || "N/A",
            hbondAcceptors: props.HBondAcceptorCount || "N/A"
        };
    } catch (error) {
        console.error(`Error fetching data for CID ${cid}:`, error);
        return null;
    }
}

async function searchPubChem(query) {
    if (!query) {
        loadDefaultMedications();
        return;
    }

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>Searching PubChem for "${query}"...</p>
        </div>
    `;

    try {
        const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`;
        const res = await fetch(searchUrl);
        const data = await res.json();

        if (data.IdentifierList && data.IdentifierList.CID) {
            const cids = data.IdentifierList.CID.slice(0, 5);
            const promises = cids.map(cid => fetchMedicationDetails(cid, "Searched"));
            const results = await Promise.all(promises);

            currentMedications = results.filter(med => med !== null);
            renderMedications(currentMedications, true); // Pass true for isSearchResult
        } else {
            grid.innerHTML = `<p class="no-results">No results found for "${query}" on PubChem.</p>`;
        }
    } catch (error) {
        console.error("Search error:", error);
        grid.innerHTML = `<p class="error">Error searching PubChem. Please try again.</p>`;
    }
}

async function findSimilar(cid, name) {
    closeModalHandler();
    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>Finding compounds similar to ${name}...</p>
        </div>
    `;

    // Update filter buttons to show we are in a special view
    filterBtns.forEach(b => b.classList.remove('active'));

    try {
        // Use 90% similarity threshold
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/cid/${cid}/cids/JSON?Threshold=90&MaxRecords=10`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.IdentifierList && data.IdentifierList.CID) {
            const cids = data.IdentifierList.CID.filter(c => c !== cid).slice(0, 8); // Exclude self, limit to 8

            if (cids.length === 0) {
                grid.innerHTML = `<div class="loading-container"><p>No similar compounds found.</p><button class="filter-btn active" onclick="loadDefaultMedications()" style="margin-top:1rem">Back to List</button></div>`;
                return;
            }

            const promises = cids.map(similarCid => fetchMedicationDetails(similarCid, "Similar Compound"));
            const results = await Promise.all(promises);

            currentMedications = results.filter(med => med !== null);

            // Add a header for the similar view
            grid.innerHTML = `
                <div class="category-header" style="color: var(--accent-color)">
                    Similar to ${name}
                    <button class="filter-btn" onclick="loadDefaultMedications()" style="margin-left: auto; font-size: 0.9rem;">Back to List</button>
                </div>
            `;

            currentMedications.forEach(med => {
                grid.appendChild(createCard(med));
            });
        } else {
            grid.innerHTML = `<div class="loading-container"><p>No similar compounds found.</p><button class="filter-btn active" onclick="loadDefaultMedications()" style="margin-top:1rem">Back to List</button></div>`;
        }
    } catch (error) {
        console.error("Similarity search error:", error);
        grid.innerHTML = `<p class="error">Error finding similar compounds. Please try again.</p>`;
    }
}

async function loadDefaultMedications() {
    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>Loading medication data from PubChem...</p>
        </div>
    `;

    // Reset filter UI
    document.querySelector('[data-filter="all"]').classList.add('active');

    try {
        currentMedications = [];
        console.log("Loading defaults. Count:", defaultMedications.length);

        if (defaultMedications.length === 0) {
            console.warn("defaultMedications is empty! Restoring defaults...");
            // Hardcode restore if empty (Emergency Fallback)
            defaultMedications.push(
                { cid: 5362119, category: "Cardiovascular" },
                { cid: 60823, category: "Cardiovascular" },
                { cid: 3446, category: "Neurological" },
                { cid: 6047, category: "Neurological" }
            );
        }

        // Fetch sequentially to avoid overwhelming the browser/API
        for (const config of defaultMedications) {
            console.log("Fetching:", config.cid);
            const med = await fetchMedicationDetails(config.cid, config.category);
            if (med) {
                currentMedications.push(med);
            } else {
                console.error("Failed to fetch:", config.cid);
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        renderGroupedMedications(currentMedications);
    } catch (error) {
        console.error("Error loading default medications:", error);
        grid.innerHTML = `<p class="error">Failed to load medications. Please try again later.</p>`;
    }
}

function getImageUrl(cid) {
    return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
}

// Interaction Checker State
let selectedForInteraction = [];

// Load from LocalStorage or use defaults
function loadStoredMedications() {
    const stored = localStorage.getItem('medications');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Only use stored if it has items. If it's empty, revert to defaults.
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Update defaultMedications reference
                defaultMedications.length = 0;
                parsed.forEach(m => defaultMedications.push(m));
            }
        } catch (e) {
            console.error("Error loading from localStorage", e);
        }
    }
}

function saveMedications() {
    localStorage.setItem('medications', JSON.stringify(defaultMedications));
}

function addToDashboard(cid, category) {
    // Check if already exists
    if (defaultMedications.some(m => m.cid === cid)) {
        alert("Medication already in dashboard!");
        return;
    }

    // Prompt for category if not provided or generic
    let finalCategory = category;
    if (!category || category === "Searched" || category === "Similar Compound") {
        const userCat = prompt("Add to which category? (Enter 'n' for Neurological, 'c' for Cardiovascular)", "n");
        if (userCat && userCat.toLowerCase().startsWith('c')) {
            finalCategory = "Cardiovascular";
        } else {
            finalCategory = "Neurological";
        }
    }

    defaultMedications.push({ cid, category: finalCategory });
    saveMedications(); // Save to persistence
    loadDefaultMedications(); // Reload to show new item
}

function createCard(med, isSearchResult = false) {
    const card = document.createElement('div');
    card.className = `med-card ${med.category.toLowerCase().replace(' ', '-')}`;

    let actionBtn = '';
    if (isSearchResult) {
        actionBtn = `
            <button class="add-btn" onclick="event.stopPropagation(); addToDashboard(${med.cid}, '${med.category}')">
                + Add
            </button>
        `;
    }

    // Add checkbox for interaction checker
    const checkId = `check-${med.cid}`;
    const isChecked = selectedForInteraction.some(m => m.cid === med.cid);

    card.innerHTML = `
        <div class="med-image">
            <img src="${getImageUrl(med.cid)}" alt="${med.name} Structure" loading="lazy">
            ${actionBtn}
            <div class="interaction-select" onclick="event.stopPropagation()">
                <input type="checkbox" id="${checkId}" ${isChecked ? 'checked' : ''} onchange="toggleInteraction(${med.cid}, '${med.name}')">
            </div>
        </div>
        <div class="med-info">
            <span class="med-category">${med.category}</span>
            <h3 class="med-name">${med.name}${med.brandName ? ` <span class="brand-name">(${med.brandName})</span>` : ''}</h3>
            <div class="med-stats">
                <span>${med.formula}</span>
                <span>${med.weight}</span>
            </div>
            <p class="med-desc">${med.description}</p>
        </div>
    `;
    card.addEventListener('click', () => openModal(med));
    return card;
}

function toggleInteraction(cid, name) {
    const index = selectedForInteraction.findIndex(m => m.cid === cid);
    if (index === -1) {
        if (selectedForInteraction.length >= 4) {
            alert("You can compare up to 4 medications at once.");
            document.getElementById(`check-${cid}`).checked = false;
            return;
        }
        selectedForInteraction.push({ cid, name });
    } else {
        selectedForInteraction.splice(index, 1);
    }
    updateInteractionPanel();
}

function updateInteractionPanel() {
    const panel = document.getElementById('interactionPanel');
    const list = document.getElementById('selectedDrugsList');
    const tab = document.getElementById('interactionTab');

    if (selectedForInteraction.length > 0) {
        tab.style.display = 'flex';
        tab.innerHTML = `<span>⚖️ Check Interactions (${selectedForInteraction.length})</span>`;
    } else {
        tab.style.display = 'none';
        panel.classList.remove('active');
    }

    list.innerHTML = selectedForInteraction.map(drug => `
        <div class="drug-tag">
            ${drug.name}
            <span onclick="toggleInteraction(${drug.cid}, '${drug.name}'); document.getElementById('check-${drug.cid}').checked = false;">×</span>
        </div>
    `).join('');
}

async function checkInteractions() {
    const resultsDiv = document.getElementById('interactionResults');
    resultsDiv.innerHTML = '<div class="spinner"></div> Checking FDA database...';

    if (selectedForInteraction.length < 2) {
        resultsDiv.innerHTML = "Please select at least 2 medications to check for interactions.";
        return;
    }

    const drugNames = selectedForInteraction.map(d => d.name);
    // Simple query construction for OpenFDA (searching for pairs)
    // Note: OpenFDA interaction search is complex; this is a simplified "label search" approach
    // We search for the first drug's label mentioning the second drug in "drug_interactions" section

    try {
        let findings = [];

        for (let i = 0; i < drugNames.length; i++) {
            for (let j = i + 1; j < drugNames.length; j++) {
                const drug1 = drugNames[i];
                const drug2 = drugNames[j];

                const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${drug1}"+AND+drug_interactions:"${drug2}"&limit=1`;

                try {
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.results && data.results.length > 0) {
                        const interactions = data.results[0].drug_interactions ? data.results[0].drug_interactions[0] : "Interaction data found but text unavailable.";
                        // Truncate for display
                        const snippet = interactions.length > 300 ? interactions.substring(0, 300) + "..." : interactions;
                        findings.push(`<strong>${drug1} + ${drug2}:</strong><br>${snippet}<br><br>`);
                    }
                } catch (e) {
                    // No interaction found or error
                }
            }
        }

        if (findings.length > 0) {
            resultsDiv.innerHTML = findings.join('');
        } else {
            resultsDiv.innerHTML = "No specific interactions found in FDA labels for these combinations.";
        }

    } catch (error) {
        console.error("Interaction check error:", error);
        resultsDiv.innerHTML = "Error checking interactions.";
    }
}

function renderMedications(meds, isSearchResult = false) {
    // Used for search/filter results where grouping might not make sense or is mixed
    const existingHeader = grid.querySelector('.category-header');
    if (!existingHeader) grid.innerHTML = ''; // Clear unless we have a custom header

    if (meds.length === 0) {
        grid.innerHTML += '<p class="no-results">No medications found.</p>';
        return;
    }

    meds.forEach(med => {
        try {
            grid.appendChild(createCard(med, isSearchResult));
        } catch (e) {
            console.error("Error creating card for", med.name, e);
        }
    });
}

function renderGroupedMedications(meds) {
    grid.innerHTML = '';

    const categories = ['Neurological', 'Cardiovascular'];

    categories.forEach(category => {
        const categoryMeds = meds.filter(m => m.category === category);
        if (categoryMeds.length > 0) {
            const header = document.createElement('div');
            header.className = `category-header ${category.toLowerCase()}`;
            header.textContent = category;
            grid.appendChild(header);

            categoryMeds.forEach(med => {
                grid.appendChild(createCard(med));
            });
        }
    });

    // Render any others
    const others = meds.filter(m => !categories.includes(m.category));
    if (others.length > 0) {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.textContent = 'Other';
        grid.appendChild(header);
        others.forEach(med => grid.appendChild(createCard(med)));
    }
}

async function openModal(med) {
    let categoryColor = 'var(--accent-color)';
    if (med.category === 'Neurological') categoryColor = 'var(--neurological-color)';
    if (med.category === 'Cardiovascular') categoryColor = 'var(--cardio-color)';

    modalContent.innerHTML = `
        <div class="modal-left-col">
            <div id="mol-3d-container" class="mol-container"></div>
            <div style="position: absolute; bottom: 20px; left: 20px; color: white; background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 4px; pointer-events: none;">
                Rotate: Left Click | Zoom: Scroll
            </div>
        </div>
        
        <div class="modal-right-col">
            <button class="modal-close" id="modalCloseBtn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div>
                <span class="modal-category" style="color: ${categoryColor}">${med.category}</span>
                <h2 class="modal-title">${med.name}</h2>
            </div>
            
            <div class="modal-section">
                <h3>Description</h3>
                <p>${med.description}</p>
            </div>

            <div class="modal-section">
                <h3>Mechanism of Action</h3>
                <p>${med.mechanism}</p>
            </div>
            
            <div class="modal-section">
                <h3>Similar Compounds</h3>
                <div id="similar-compounds-list" class="similar-list">
                    <div class="spinner"></div> Loading similar drugs...
                </div>
            </div>

            <div class="modal-section">
                <h3>Chemical Identifiers</h3>
                <div class="properties-grid">
                    <div class="property-item full-width">
                        <span class="property-label">IUPAC Name</span>
                        <span class="property-value small-text">${med.iupac}</span>
                    </div>
                    <div class="property-item full-width">
                        <span class="property-label">Canonical SMILES</span>
                        <span class="property-value code-text">${med.smiles}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">InChIKey</span>
                        <span class="property-value code-text">${med.inchikey}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">PubChem CID</span>
                        <span class="property-value">${med.cid}</span>
                    </div>
                </div>
            </div>

            <div class="modal-section">
                <h3>Physical Properties</h3>
                <div class="properties-grid">
                    <div class="property-item">
                        <span class="property-label">Formula</span>
                        <span class="property-value">${med.formula}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">Molecular Weight</span>
                        <span class="property-value">${med.weight}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">XLogP3</span>
                        <span class="property-value">${med.xlogp}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">TPSA</span>
                        <span class="property-value">${med.tpsa} Å²</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">Complexity</span>
                        <span class="property-value">${med.complexity}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">Formal Charge</span>
                        <span class="property-value">${med.charge}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">H-Bond Donors</span>
                        <span class="property-value">${med.hbondDonors}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">H-Bond Acceptors</span>
                        <span class="property-value">${med.hbondAcceptors}</span>
                    </div>
                </div>
            </div>

            <button class="btn-similar" onclick="findSimilar(${med.cid}, '${med.name}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Find Similar Compounds
            </button>
        </div>
    `;

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Initialize 3D Viewer
    setTimeout(() => init3DViewer(med.cid), 100);

    // Fetch Similar Drugs automatically
    fetchSimilarForModal(med.cid);

    document.getElementById('modalCloseBtn').addEventListener('click', closeModalHandler);
}

function init3DViewer(cid) {
    const element = document.getElementById('mol-3d-container');
    const config = { backgroundColor: '#0f172a' };
    const viewer = $3Dmol.createViewer(element, config);

    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;

    jQuery.ajax(sdfUrl, {
        success: function (data) {
            viewer.addModel(data, "sdf");
            viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: "Jmol" }, sphere: { scale: 0.25 } });
            viewer.zoomTo();
            viewer.render();
        },
        error: function (hdr, status, err) {
            console.error("Failed to load SDF " + sdfUrl + ": " + err);
            element.innerHTML = '<p style="color:white; text-align:center; padding-top: 50%;">3D Structure not available</p>';
        },
    });
}

async function fetchSimilarForModal(cid) {
    const container = document.getElementById('similar-compounds-list');
    try {
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/cid/${cid}/cids/JSON?Threshold=85&MaxRecords=6`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.IdentifierList && data.IdentifierList.CID) {
            const cids = data.IdentifierList.CID.filter(c => c !== cid).slice(0, 5);

            // Fetch names for these CIDs
            const detailsPromises = cids.map(id => fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${id}/property/Title/JSON`).then(r => r.json()));
            const detailsData = await Promise.all(detailsPromises);

            container.innerHTML = `<div class="similar-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
                ${detailsData.map(d => {
                const props = d.PropertyTable.Properties[0];
                return `
                        <div class="similar-item" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; text-align: center; cursor: pointer;" onclick="fetchMedicationDetails(${props.CID}, 'Similar').then(m => openModal(m))">
                            <img src="${getImageUrl(props.CID)}" style="width: 50px; height: 50px; object-fit: contain;">
                            <div style="font-size: 0.8rem; margin-top: 5px;">${props.Title}</div>
                        </div>
                    `;
            }).join('')}
            </div>`;
        } else {
            container.innerHTML = "No similar compounds found.";
        }
    } catch (e) {
        container.innerHTML = "Error loading similar compounds.";
    }
}

function closeModalHandler() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

closeModal.addEventListener('click', closeModalHandler);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModalHandler();
});

// Filter Logic
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;

        if (!searchInput.value) {
            if (filter === 'all') {
                renderGroupedMedications(currentMedications);
            } else {
                grid.innerHTML = ''; // Clear grid for filtered view
                renderMedications(currentMedications.filter(med => med.category === filter));
            }
        }
    });
});

// Live Search Logic
const handleSearch = debounce((e) => {
    const query = e.target.value.trim();
    if (query.length > 2) {
        searchPubChem(query);
    } else if (query.length === 0) {
        loadDefaultMedications();
    }
}, 500);

searchInput.addEventListener('input', handleSearch);

// Interaction Tab Logic
const interactionTab = document.createElement('div');
interactionTab.id = 'interactionTab';
interactionTab.className = 'interaction-tab';
interactionTab.style.display = 'none';
interactionTab.onclick = () => document.getElementById('interactionPanel').classList.toggle('active');
document.body.appendChild(interactionTab);

const interactionPanel = document.createElement('div');
interactionPanel.id = 'interactionPanel';
interactionPanel.className = 'interaction-panel';
interactionPanel.innerHTML = `
    <div class="panel-tabs">
        <button class="panel-tab active" onclick="switchPanelTab('interactions')">⚖️ Interactions</button>
        <button class="panel-tab" onclick="switchPanelTab('qa')">💬 Ask Questions</button>
    </div>
    
    <div id="interactionsTabContent" class="panel-tab-content active">
        <h3>Interaction Checker</h3>
        <div id="selectedDrugsList" class="selected-drugs-list"></div>
        <div style="display: flex; gap: 1rem;">
            <button class="check-btn" onclick="checkInteractions()">Analyze Interactions</button>
            <button class="compare-btn" id="compareBtn" onclick="compareSelected()" disabled>Compare (2)</button>
        </div>
        <div id="interactionResults" class="interaction-results">
            <p style="color: var(--text-secondary); text-align: center;">
                Select medications to check for potential interactions.<br>
                <span style="font-size: 0.8rem; opacity: 0.7;">(Automatically checks for Drug-Drug, Food, and Alcohol interactions)</span>
            </p>
        </div>
    </div>
    
    <div id="qaTabContent" class="panel-tab-content">
        <h3>Ask About Medications</h3>
        <div class="qa-interface">
            <select id="qaDrugSelect" class="qa-drug-select">
                <option value="">Select a medication...</option>
            </select>
            <textarea id="qaQuestion" class="qa-question-input" placeholder="Ask a question about this medication (e.g., 'What is it used for?', 'What are the side effects?', 'How does it work?')" rows="3"></textarea>
            <button class="check-btn" onclick="askDrugQuestion()" id="qaSubmitBtn" disabled>Ask Question</button>
            <div id="qaAnswer" class="qa-answer"></div>
        </div>
    </div>
`;
document.body.appendChild(interactionPanel);

// Comparison Modal HTML
const comparisonModalOverlay = document.createElement('div');
comparisonModalOverlay.className = 'modal-overlay';
comparisonModalOverlay.id = 'comparisonModalOverlay';
comparisonModalOverlay.innerHTML = `
    <div class="comparison-modal-content" id="comparisonModalContent">
        <!-- Content injected via JS -->
    </div>
`;
document.body.appendChild(comparisonModalOverlay);

comparisonModalOverlay.addEventListener('click', (e) => {
    if (e.target === comparisonModalOverlay) {
        comparisonModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

function updateInteractionPanel() {
    const panel = document.getElementById('interactionPanel');
    const list = document.getElementById('selectedDrugsList');
    const tab = document.getElementById('interactionTab');
    const compareBtn = document.getElementById('compareBtn');

    if (selectedForInteraction.length > 0) {
        tab.style.display = 'flex';
        tab.innerHTML = `<span>⚖️ Check Interactions (${selectedForInteraction.length})</span>`;
    } else {
        tab.style.display = 'none';
        panel.classList.remove('active');
    }

    // Enable compare button if 2-4 drugs are selected
    if (selectedForInteraction.length >= 2 && selectedForInteraction.length <= 4) {
        compareBtn.disabled = false;
        compareBtn.textContent = `Compare (${selectedForInteraction.length})`;
    } else {
        compareBtn.disabled = true;
        compareBtn.textContent = `Compare (${selectedForInteraction.length})`;
    }

    list.innerHTML = selectedForInteraction.map(drug => `
        <div class="drug-tag">
            ${drug.name}
            <span onclick="toggleInteraction(${drug.cid}, '${drug.name}'); document.getElementById('check-${drug.cid}').checked = false;">×</span>
        </div>
    `).join('');
}

async function compareSelected() {
    const numDrugs = selectedForInteraction.length;
    if (numDrugs < 2) {
        alert("Please select at least 2 medications to compare.");
        return;
    }

    // Fetch details for all selected drugs
    const drugDetails = await Promise.all(
        selectedForInteraction.map(drug => fetchMedicationDetails(drug.cid, "Comparison"))
    );

    const content = document.getElementById('comparisonModalContent');

    if (numDrugs === 2) {
        // Two-column layout for 2 drugs
        const [d1, d2] = drugDetails;
        const analysis = analyzeCommonalities(d1, d2);

        content.innerHTML = `
            <button class="modal-close" onclick="document.getElementById('comparisonModalOverlay').classList.remove('active'); document.body.style.overflow = '';">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <div class="comparison-header-section">
                <h2 class="comparison-main-title">Drug Comparison</h2>
                <p class="comparison-subtitle">${d1.name} vs ${d2.name}</p>
            </div>

            ${renderAnalysisSection(analysis)}
            
            <div class="comparison-columns">
                ${renderComparisonColumn(d1)}
                ${renderComparisonColumn(d2)}
            </div>
        `;
    } else {
        // Horizontal scroll layout for 3+ drugs
        const drugNames = drugDetails.map(d => d.name).join(', ');
        const analysis = analyzeMultiDrugCommonalities(drugDetails);

        content.innerHTML = `
            <button class="modal-close" onclick="document.getElementById('comparisonModalOverlay').classList.remove('active'); document.body.style.overflow = '';">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <div class="comparison-header-section">
                <h2 class="comparison-main-title">Multi-Drug Comparison (${numDrugs})</h2>
                <p class="comparison-subtitle">${drugNames}</p>
            </div>

            ${renderAnalysisSection(analysis)}
            
            <div class="comparison-scroll-hint">← Scroll horizontally to see all drugs →</div>
            <div class="comparison-scroll-container">
                ${drugDetails.map(d => renderComparisonCard(d)).join('')}
            </div>
        `;
    }

    document.getElementById('comparisonModalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Init 3D viewers
    setTimeout(() => {
        drugDetails.forEach(d => {
            const el = document.getElementById(`mol-3d-${d.cid}`);
            if (el) init3DViewer(d.cid, `mol-3d-${d.cid}`);
        });
    }, 300);
}

function analyzeCommonalities(d1, d2) {
    const commonalities = [];
    const differences = [];

    // Category comparison
    if (d1.category === d2.category) {
        commonalities.push(`Both are ${d1.category} medications`);
    } else {
        differences.push(`Different categories: ${d1.name} is ${d1.category}, ${d2.name} is ${d2.category}`);
    }

    // H-Bond comparison
    if (d1.hbondDonors === d2.hbondDonors) {
        commonalities.push(`Same number of H-bond donors (${d1.hbondDonors})`);
    } else {
        differences.push(`H-bond donors: ${d1.name} has ${d1.hbondDonors}, ${d2.name} has ${d2.hbondDonors}`);
    }

    if (d1.hbondAcceptors === d2.hbondAcceptors) {
        commonalities.push(`Same number of H-bond acceptors (${d1.hbondAcceptors})`);
    } else {
        differences.push(`H-bond acceptors: ${d1.name} has ${d1.hbondAcceptors}, ${d2.name} has ${d2.hbondAcceptors}`);
    }

    // Molecular weight comparison
    const w1 = parseFloat(d1.weight);
    const w2 = parseFloat(d2.weight);
    const weightDiff = Math.abs(w1 - w2);
    if (weightDiff < 50) {
        commonalities.push(`Similar molecular weights (~${w1.toFixed(1)} g/mol)`);
    } else {
        differences.push(`Molecular weight: ${d1.name} is ${weightDiff > 0 ? 'heavier' : 'lighter'} (${Math.abs(w1 - w2).toFixed(1)} g/mol difference)`);
    }

    // XLogP comparison (lipophilicity)
    const x1 = parseFloat(d1.xlogp);
    const x2 = parseFloat(d2.xlogp);
    if (!isNaN(x1) && !isNaN(x2)) {
        const xDiff = Math.abs(x1 - x2);
        if (xDiff < 1) {
            commonalities.push(`Similar lipophilicity (XLogP ~${x1.toFixed(1)})`);
        } else {
            const morePhilic = x1 > x2 ? d1.name : d2.name;
            differences.push(`${morePhilic} is more lipophilic (XLogP difference: ${xDiff.toFixed(1)})`);
        }
    }

    return { commonalities, differences };
}

function renderAnalysisSection(analysis) {
    return `
        <div class="analysis-section">
            <div class="analysis-column commonalities">
                <h3><span class="icon">✓</span> Commonalities</h3>
                ${analysis.commonalities.length > 0
            ? `<ul>${analysis.commonalities.map(c => `<li>${c}</li>`).join('')}</ul>`
            : '<p class="empty-state">No significant commonalities found</p>'}
            </div>
            <div class="analysis-column differences">
                <h3><span class="icon">⚡</span> Key Differences</h3>
                ${analysis.differences.length > 0
            ? `<ul>${analysis.differences.map(d => `<li>${d}</li>`).join('')}</ul>`
            : '<p class="empty-state">No significant differences found</p>'}
            </div>
        </div>
    `;
}

function renderComparisonColumn(med) {
    let categoryColor = med.category === 'Neurological' ? 'var(--neurological-color)' : 'var(--cardio-color)';

    return `
        <div class="comparison-column">
            <div class="comparison-header">
                <span class="modal-category" style="color: ${categoryColor}">${med.category}</span>
                <h2 class="modal-title" style="font-size: 1.8rem; margin-bottom: 0.5rem;">${med.name}</h2>
            </div>
            
            <div id="mol-3d-${med.cid}" class="comparison-3d-container"></div>
            
            <div class="comparison-properties">
                <div class="comparison-row">
                    <span class="comparison-label">Formula</span>
                    <span class="comparison-value">${med.formula}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">Weight</span>
                    <span class="comparison-value">${med.weight}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">XLogP3</span>
                    <span class="comparison-value">${med.xlogp}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">TPSA</span>
                    <span class="comparison-value">${med.tpsa}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">H-Bond Donors</span>
                    <span class="comparison-value">${med.hbondDonors}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">H-Bond Acceptors</span>
                    <span class="comparison-value">${med.hbondAcceptors}</span>
                </div>
            </div>
            
            <div class="modal-section" style="margin-top: 2rem;">
                <h3>Mechanism</h3>
                <p style="font-size: 0.9rem;">${med.mechanism}</p>
            </div>
        </div>
    `;
}

// Overload init3DViewer to accept element ID
function init3DViewer(cid, elementId = 'mol-3d-container') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`3D viewer element not found: ${elementId}`);
        return;
    }

    console.log(`Initializing 3D viewer for CID ${cid} in element ${elementId}`);

    // Clear any existing content
    element.innerHTML = '';

    const config = {
        backgroundColor: '#0f172a',
        antialias: true
    };

    const viewer = $3Dmol.createViewer(element, config);

    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;

    jQuery.ajax(sdfUrl, {
        success: function (data) {
            viewer.addModel(data, "sdf");
            viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: "Jmol" }, sphere: { scale: 0.25 } });
            viewer.zoomTo();
            viewer.render();
            viewer.resize();
            console.log(`3D viewer loaded successfully for CID ${cid}`);
        },
        error: function (hdr, status, err) {
            console.error("Failed to load SDF " + sdfUrl + ": " + err);
            element.innerHTML = '<p style="color:white; text-align:center; padding-top: 50%;">3D Structure not available</p>';
        },
    });
}

async function checkInteractions() {
    const resultsDiv = document.getElementById('interactionResults');
    resultsDiv.innerHTML = '<div class="spinner"></div> Checking FDA database (Drugs & Food)...';

    const drugNames = selectedForInteraction.map(d => d.name);
    let findings = [];

    try {
        // 1. Check Drug-Drug Interactions
        if (drugNames.length >= 2) {
            for (let i = 0; i < drugNames.length; i++) {
                for (let j = i + 1; j < drugNames.length; j++) {
                    const drug1 = drugNames[i];
                    const drug2 = drugNames[j];

                    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${drug1}"+AND+drug_interactions:"${drug2}"&limit=1`;

                    try {
                        const res = await fetch(url);
                        const data = await res.json();

                        if (data.results && data.results.length > 0) {
                            const interactions = data.results[0].drug_interactions ? data.results[0].drug_interactions[0] : "Interaction data found but text unavailable.";
                            const snippet = interactions.length > 200 ? interactions.substring(0, 200) + "..." : interactions;
                            findings.push(`<div class="interaction-item"><span class="interaction-pair">⚠️ ${drug1} + ${drug2}</span>${snippet}</div>`);
                        }
                    } catch (e) { }
                }
            }
        }

        // 2. Check Food/Dietary Interactions (Grapefruit, Alcohol)
        for (const drug of drugNames) {
            const foodQueries = ['grapefruit', 'alcohol', 'food'];

            for (const food of foodQueries) {
                const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${drug}"+AND+drug_interactions:"${food}"&limit=1`;
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.results && data.results.length > 0) {
                        findings.push(`<div class="food-interaction">🍽️ <strong>${drug}</strong> may interact with <strong>${food}</strong>. Check label.</div>`);
                    }
                } catch (e) { }
            }
        }

        if (findings.length > 0) {
            resultsDiv.innerHTML = findings.join('');
        } else {
            resultsDiv.innerHTML = "No specific interactions found in FDA labels.";
        }

    } catch (error) {
        console.error("Interaction check error:", error);
        resultsDiv.innerHTML = "Error checking interactions.";
    }
}

async function askDrugQuestion() {
    const select = document.getElementById('qaDrugSelect');
    const questionInput = document.getElementById('qaQuestion');
    const answerDiv = document.getElementById('qaAnswer');
    const submitBtn = document.getElementById('qaSubmitBtn');

    const cid = select.value;
    const question = questionInput.value.trim();

    if (!cid || !question) return;

    // Find the medication
    const med = currentMedications.find(m => m.cid == cid);
    if (!med) return;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';
    answerDiv.innerHTML = '<div class="spinner"></div> <p style="color: var(--text-secondary);">Searching reliable medical sources...</p>';

    try {
        const answer = await generateAnswerFromPubChem(med, question);

        answerDiv.innerHTML = `
            <div class="qa-answer-content">
                <h4>${med.name}${med.brandName ? ` (${med.brandName})` : ''}</h4>
                <p class="qa-question-display"><strong>Q:</strong> ${question}</p>
                <div class="qa-answer-text">
                    <strong>A:</strong> ${answer.text}
                </div>
                <div class="qa-sources">
                    <strong>Sources:</strong>
                    ${answer.sources.map(source => `<a href="${source.url}" target="_blank" class="citation">${source.name}</a>`).join(' • ')}
                </div>
                <p class="qa-disclaimer">
                    <em>⚠️ This information is for educational purposes only. Always consult with a healthcare professional for medical advice.</em>
                </p>
            </div>
        `;
    } catch (error) {
        console.error('Error answering question:', error);
        answerDiv.innerHTML = `
            <div class="qa-error">
                <p>Sorry, I couldn't find a reliable answer to your question. Please try rephrasing or consult a healthcare professional.</p>
            </div>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ask Question';
    }
}

async function generateAnswerFromPubChem(med, question) {
    const questionLower = question.toLowerCase();
    let answerText = '';
    const sources = [
        { name: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${med.cid}` }
    ];

    // Determine question type and provide appropriate answer
    if (questionLower.includes('used for') || questionLower.includes('indication') || questionLower.includes('treat')) {
        answerText = `${med.name} is used for: ${med.description || 'Information about indications is available in the PubChem database.'}`;
    } else if (questionLower.includes('side effect') || questionLower.includes('adverse')) {
        answerText = `For detailed information about side effects of ${med.name}, please refer to the FDA drug label and PubChem pharmacology data. Common side effects and adverse reactions are documented in these reliable sources.`;
        sources.push({ name: 'FDA Drug Labels', url: 'https://www.accessdata.fda.gov/scripts/cder/daf/' });
    } else if (questionLower.includes('how') && (questionLower.includes('work') || questionLower.includes('mechanism'))) {
        answerText = `Mechanism of action: ${med.mechanism || 'The mechanism of action for this medication can be found in the PubChem pharmacology section.'}`;
    } else if (questionLower.includes('interact') || questionLower.includes('drug interaction')) {
        answerText = `To check for drug interactions with ${med.name}, use the "Analyze Interactions" feature in the Interactions tab. This will search the FDA database for known drug-drug, drug-food, and drug-alcohol interactions.`;
    } else if (questionLower.includes('dosage') || questionLower.includes('dose')) {
        answerText = `Dosage information for ${med.name} should be obtained from the FDA-approved drug label or your healthcare provider. Dosing varies based on the condition being treated, patient age, weight, and other factors.`;
        sources.push({ name: 'MedlinePlus', url: `https://medlineplus.gov/druginfo/meds/` });
    } else {
        // Generic answer with available data
        answerText = `${med.name} (${med.formula}) has a molecular weight of ${med.weight}. ${med.description || ''} For specific medical information, please consult the sources below.`;
    }

    return { text: answerText, sources };
}

// Enable submit button when both drug and question are filled
setTimeout(() => {
    const select = document.getElementById('qaDrugSelect');
    const questionInput = document.getElementById('qaQuestion');
    const submitBtn = document.getElementById('qaSubmitBtn');

    if (select && questionInput && submitBtn) {
        [select, questionInput].forEach(el => {
            el.addEventListener('input', () => {
                submitBtn.disabled = !select.value || !questionInput.value.trim();
            });
        });
    }
}, 1000);

// Initial Load
console.log("Initializing app...");
loadStoredMedications(); // Load persistence first
loadDefaultMedications();

// Q&A Tab Switching
function switchPanelTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.panel-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.panel-tab-content').forEach(content => content.classList.remove('active'));
    if (tabName === 'interactions') {
        document.getElementById('interactionsTabContent').classList.add('active');
    } else if (tabName === 'qa') {
        document.getElementById('qaTabContent').classList.add('active');
        updateQADrugSelect();
    }
}

function updateQADrugSelect() {
    const select = document.getElementById('qaDrugSelect');
    if (!select) return;
    
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select a medication...</option>';
    currentMedications.forEach(med => {
        const option = document.createElement('option');
        option.value = med.cid;
        option.textContent = med.brandName ? `${med.name} (${med.brandName})` : med.name;
        select.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue) select.value = currentValue;
}
