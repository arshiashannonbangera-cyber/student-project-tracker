const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

let projects = [];
let editingId = null;
let isBusy = false;
let hasLoadedProjects = false;

function showMessage(text) {
  message.textContent = text;
}

// Disable form and project-action buttons while a request is running.
function setBusy(busy) {
  isBusy = busy;

  saveButton.disabled = busy;
  cancelButton.disabled = busy;
  nameInput.disabled = busy;
  statusInput.disabled = busy;

  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = busy;
  });
}

// Send a request to the API and handle HTTP and network errors.
async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      'Could not connect to the server. Check that it is running and try again.'
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    // The response might not contain JSON.
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `The request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

// Load the latest collection from Express and SQLite.
async function loadProjects({
  loadingMessage = 'Loading projects...',
  successMessage = null
} = {}) {
  showMessage(loadingMessage);

  try {
    const data = await apiRequest('/api/projects');

    if (!Array.isArray(data)) {
      throw new Error('The server returned an invalid project list.');
    }

    projects = data;
    hasLoadedProjects = true;

    // Exit Edit mode if the project no longer exists.
    if (
      editingId !== null &&
      !projects.some(project => project.id === editingId)
    ) {
      resetForm();
    }

    renderProjects();

    if (successMessage) {
      showMessage(successMessage);
    } else if (projects.length === 0) {
      showMessage('No projects yet. Add your first project above.');
    } else {
      showMessage('Projects loaded from the database.');
    }

    return { ok: true };
  } catch (error) {
    // Do not show the empty state if the first load failed.
    if (!hasLoadedProjects) {
      emptyState.hidden = true;
    }

    showMessage(`Could not load projects. ${error.message}`);

    return { ok: false, error: error.message };
  }
}

function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('span');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('span');
    projectStatus.textContent = ` — ${project.status} `;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = isBusy;

    editButton.addEventListener('click', () => {
      if (isBusy) return;

      // Keep the ID assigned by the server.
      editingId = project.id;

      nameInput.value = project.name;
      statusInput.value = project.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;

      showMessage('Editing project.');
      nameInput.focus();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = isBusy;

    deleteButton.addEventListener('click', async () => {
      if (isBusy) return;

      const projectToDelete = projects.find(
        item => item.id === project.id
      );

      if (!projectToDelete) {
        showMessage('This project could not be found. Reload the list and try again.');
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${projectToDelete.name}"?`
      );

      // A cancelled deletion sends no API request.
      if (!confirmed) {
        return;
      }

      setBusy(true);
      showMessage('Deleting project...');

      try {
        await apiRequest(
          `/api/projects/${encodeURIComponent(projectToDelete.id)}`,
          { method: 'DELETE' }
        );
      } catch (error) {
        // Keep the current list and edit form if deletion fails.
        showMessage(error.message);
        setBusy(false);
        return;
      }

      // If the deleted project was being edited, exit Edit mode.
      if (editingId === projectToDelete.id) {
        resetForm();
      }

      const result = await loadProjects({
        loadingMessage: 'Refreshing projects...',
        successMessage: 'Project deleted successfully.'
      });

      if (!result.ok) {
        showMessage(
          `Project deleted, but the list could not be refreshed. ${result.error}`
        );
      }

      setBusy(false);
    });

    listItem.append(
      projectName,
      projectStatus,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  // Show the empty state only after a successful API load.
  emptyState.hidden = !hasLoadedProjects || projects.length > 0;
}

function resetForm() {
  form.reset();
  editingId = null;

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// One submit listener handles both creating and editing.
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (isBusy) return;

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (name === '') {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    return;
  }

  if (name.length > 80) {
    showMessage('Project names must be 80 characters or fewer.');
    return;
  }

  const isEditing = editingId !== null;
  const targetId = editingId;

  if (
    isEditing &&
    !projects.some(project => project.id === targetId)
  ) {
    resetForm();
    renderProjects();
    showMessage('The project being edited could not be found. Please try again.');
    return;
  }

  const projectData = { name, status };

  const options = {
    method: isEditing ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(projectData)
  };

  const url = isEditing
    ? `/api/projects/${encodeURIComponent(targetId)}`
    : '/api/projects';

  setBusy(true);
  showMessage(isEditing ? 'Saving changes...' : 'Saving project...');

  try {
    await apiRequest(url, options);
  } catch (error) {
    // Keep the input and Edit mode intact when the mutation fails.
    showMessage(error.message);
    setBusy(false);
    return;
  }

  // The server accepted the mutation, so it is now safe to reset.
  resetForm();

  // Always reload the authoritative collection after a successful mutation.
  const result = await loadProjects({
    loadingMessage: 'Refreshing projects...',
    successMessage: isEditing
      ? 'Project updated successfully.'
      : 'Project added successfully.'
  });

  if (!result.ok) {
    showMessage(
      `The project was ${isEditing ? 'updated' : 'added'}, but the list could not be refreshed. ${result.error}`
    );
  }

  setBusy(false);
  nameInput.focus();
});

// Cancel edit without sending an API request.
cancelButton.addEventListener('click', () => {
  if (isBusy) return;

  resetForm();
  showMessage('Edit cancelled.');
  nameInput.focus();
});

// Load the database-backed collection when the page opens.
async function initialize() {
  setBusy(true);
  await loadProjects();
  setBusy(false);
}

initialize();